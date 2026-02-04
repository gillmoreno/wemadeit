require "json"

module Ai
  class OrganizationSuggester
    Result = Struct.new(:success?, :data, :error, keyword_init: true)

    ALLOWED_FIELDS = %w[
      name industry website email phone address city country notes
    ].freeze

    def initialize(audio_file:, transcript: nil)
      @audio_file = audio_file
      @transcript = transcript.to_s.strip
    end

    def call
      transcript = @transcript
      if transcript.blank?
        return failure("No audio or transcript provided") unless @audio_file.present?
        transcript = transcribe_audio
        return transcript if transcript.is_a?(Result) && !transcript.success?
      end

      fields = extract_fields(transcript)
      return fields if fields.is_a?(Result) && !fields.success?

      success(transcript: transcript, fields: fields)
    end

    private

    def transcribe_audio
      provider = AiProvider.active.find_by(name: "groq")
      return failure("Groq provider is not configured") unless provider
      return failure("Groq API key is missing") if provider.api_key.blank?

      stt_model = provider.stt_model.presence
      return failure("STT model is not configured for Groq") unless stt_model

      base_url = provider.base_url.presence || "https://api.groq.com"
      base_url = normalize_groq_base_url(base_url)

      conn = Faraday.new(url: base_url) do |f|
        f.request :multipart
        f.request :url_encoded
        f.response :json, content_type: /\bjson$/
      end

      file_part = Faraday::Multipart::FilePart.new(
        @audio_file.tempfile.path,
        @audio_file.content_type,
        @audio_file.original_filename
      )

      payload = {
        model: stt_model,
        file: file_part
      }

      response = conn.post("audio/transcriptions", payload) do |req|
        req.headers["Authorization"] = "Bearer #{provider.api_key}"
      end

      unless response.success?
        error_message = if response.body.is_a?(Hash)
          response.body.dig("error", "message") || response.body["error"] || response.body["message"]
        else
          response.body.to_s.strip
        end
        error_message = error_message.presence || "Unknown error"
        return failure("Transcription failed (#{response.status}): #{error_message}")
      end

      transcript = if response.body.is_a?(Hash)
        response.body["text"] || response.body["transcript"] || response.body["transcription"]
      else
        response.body.to_s
      end

      return failure("Transcription response was empty") if transcript.blank?

      transcript
    rescue StandardError => e
      failure("Transcription failed: #{e.message}")
    end

    def extract_fields(transcript)
      provider = AiProvider.active.where(name: "openai").to_a.find { |p| p.base_url.present? }
      return failure("OpenAI-compatible provider with base URL is not configured") unless provider

      model = provider.model.presence
      return failure("Model is not configured for the OpenAI-compatible provider") unless model

      client = OpenAI::Client.new(
        access_token: provider.api_key.presence || "ollama",
        uri_base: provider.base_url
      )

      system_prompt = <<~PROMPT
        You extract structured CRM organization data from a transcript.
        Return only valid JSON with the following keys:
        #{ALLOWED_FIELDS.join(", ")}.
        Use null for missing values. Do not include any extra keys or commentary.
      PROMPT

      user_prompt = <<~PROMPT
        Transcript:
        #{transcript}
      PROMPT

      response = client.chat(
        parameters: {
          model: model,
          temperature: 0.1,
          messages: [
            { role: "system", content: system_prompt },
            { role: "user", content: user_prompt }
          ]
        }
      )

      content = response.dig("choices", 0, "message", "content").to_s.strip
      json_text = extract_json(content)
      parsed = JSON.parse(json_text)

      fields = ALLOWED_FIELDS.each_with_object({}) do |key, acc|
        value = parsed[key]
        value = value.to_s.strip if value.is_a?(String)
        acc[key] = value.presence
      end

      fields
    rescue JSON::ParserError
      failure("Model response was not valid JSON")
    rescue StandardError => e
      failure("Extraction failed: #{e.message}")
    end

    def extract_json(content)
      return content if content.strip.start_with?("{") && content.strip.end_with?("}")

      match = content.match(/\{.*\}/m)
      match ? match[0] : content
    end

    def normalize_groq_base_url(base_url)
      base_url = base_url.to_s.strip
      return "https://api.groq.com/openai/v1" if base_url.blank?

      # Groq's OpenAI-compatible APIs live under /openai/v1
      return base_url if base_url.match?(%r{/openai/v1/?\z})

      base_url = base_url.chomp("/")
      "#{base_url}/openai/v1"
    end

    def success(data)
      Result.new(success?: true, data: data, error: nil)
    end

    def failure(error)
      Result.new(success?: false, data: nil, error: error)
    end
  end
end
