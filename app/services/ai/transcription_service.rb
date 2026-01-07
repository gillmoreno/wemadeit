module Ai
  class TranscriptionService < BaseService
    SUPPORTED_LANGUAGES = %w[it en es fr de pt nl pl ru ja zh].freeze

    # provider: :local, :openai, or :auto (default)
    def initialize(audio_file, language: "it", provider: :auto)
      super()
      @audio_file = audio_file
      @language = language
      @provider = provider
    end

    def call
      return failure("No audio file provided") unless @audio_file

      case resolve_provider
      when :local
        local_transcription
      when :openai
        openai_transcription
      else
        failure("No transcription provider available. Install whisper-cpp or configure OpenAI.")
      end
    end

    private

    def resolve_provider
      case @provider
      when :local
        :local if WhisperConfig.available?
      when :openai
        :openai if openai_configured?
      when :auto
        # Prefer local if available, fall back to OpenAI
        if WhisperConfig.available?
          :local
        elsif openai_configured?
          :openai
        end
      end
    end

    def local_transcription
      LocalTranscriptionService.new(@audio_file, language: @language).call
    end

    def openai_configured?
      @openai_provider ||= AiProvider.where(name: "openai").active.first
      @openai_provider.present?
    end

    def openai_transcription
      return failure("No OpenAI provider configured") unless openai_configured?

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
