module Ai
  class TranscriptionService < BaseService
    SUPPORTED_LANGUAGES = %w[it en es fr de pt nl pl ru ja zh].freeze

    def initialize(audio_file, language: "it")
      super()
      @audio_file = audio_file
      @language = language
      @openai_provider = AiProvider.where(provider_type: "openai").active.first
    end

    def call
      return failure("No audio file provided") unless @audio_file
      return failure("No OpenAI provider configured") unless @openai_provider

      client = OpenAI::Client.new(access_token: @openai_provider.api_key)

      tempfile = download_to_tempfile
      return failure("Failed to download audio file") unless tempfile

      begin
        response = client.audio.transcribe(
          parameters: {
            model: "whisper-1",
            file: tempfile,
            language: @language,
            response_format: "text"
          }
        )

        transcript = response.is_a?(String) ? response : response.dig("text")

        if transcript.present?
          success(transcript)
        else
          failure("Transcription returned empty result")
        end
      rescue StandardError => e
        failure("Transcription failed: #{e.message}")
      ensure
        tempfile&.close
        tempfile&.unlink
      end
    end

    private

    def download_to_tempfile
      return nil unless @audio_file.attached?

      extension = File.extname(@audio_file.filename.to_s)
      tempfile = Tempfile.new([ "audio", extension ])
      tempfile.binmode
      tempfile.write(@audio_file.download)
      tempfile.rewind
      tempfile
    rescue StandardError
      nil
    end
  end
end
