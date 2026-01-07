require "open3"
require "net/http"
require "uri"

module Ai
  class LocalTranscriptionService < BaseService
    SUPPORTED_LANGUAGES = %w[it en es fr de pt nl pl ru ja zh].freeze
    TIMEOUT_SECONDS = 600 # 10 minutes max for long audio

    def initialize(audio_file, language: "it")
      super()
      @audio_file = audio_file
      @language = validate_language(language)
    end

    def call
      return failure("No audio file provided") unless @audio_file
      return failure("Local Whisper not enabled") unless WhisperConfig.enabled?

      # Use server mode if configured, otherwise use CLI
      if WhisperConfig.server_mode?
        transcribe_via_server
      else
        transcribe_via_cli
      end
    end

    private

    def transcribe_via_server
      return failure("Whisper server not available at #{WhisperConfig.server_url}") unless WhisperConfig.server_available?

      tempfile = download_to_tempfile
      return failure("Failed to download audio file") unless tempfile

      begin
        transcript = call_whisper_server(tempfile)

        if transcript.present?
          success(transcript)
        else
          failure("Transcription returned empty result")
        end
      rescue StandardError => e
        Rails.logger.error("Server transcription failed: #{e.message}")
        failure("Transcription failed: #{e.message}")
      ensure
        cleanup_tempfiles(tempfile)
      end
    end

    def transcribe_via_cli
      return failure("Whisper binary not found. Run: brew install whisper-cpp") unless WhisperConfig.binary_exists?
      return failure("Whisper model not found at #{WhisperConfig.model_path}. Run: rake whisper:download") unless WhisperConfig.model_exists?

      tempfile = download_to_tempfile
      return failure("Failed to download audio file") unless tempfile

      wav_file = nil
      begin
        wav_file = ensure_wav_format(tempfile)
        transcript = run_whisper(wav_file.path)

        if transcript.present?
          success(transcript)
        else
          failure("Transcription returned empty result")
        end
      rescue Timeout::Error
        failure("Transcription timed out after #{TIMEOUT_SECONDS} seconds")
      rescue StandardError => e
        Rails.logger.error("CLI transcription failed: #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n"))
        failure("Transcription failed: #{e.message}")
      ensure
        cleanup_tempfiles(tempfile, wav_file)
      end
    end

    def call_whisper_server(tempfile)
      uri = URI.parse("#{WhisperConfig.server_url}/inference")

      Rails.logger.info("Calling Whisper server at #{uri}")

      request = Net::HTTP::Post.new(uri)
      form_data = [
        [ "file", tempfile, { filename: "audio.wav" } ],
        [ "response_format", "text" ],
        [ "language", @language ]
      ]
      request.set_form(form_data, "multipart/form-data")

      http = Net::HTTP.new(uri.host, uri.port)
      http.open_timeout = 10
      http.read_timeout = TIMEOUT_SECONDS

      response = http.request(request)

      if response.code == "200"
        clean_transcript(response.body)
      else
        raise "Server returned #{response.code}: #{response.body}"
      end
    end

    private

    def validate_language(lang)
      SUPPORTED_LANGUAGES.include?(lang) ? lang : "it"
    end

    def download_to_tempfile
      return nil unless @audio_file.attached?

      extension = File.extname(@audio_file.filename.to_s)
      tempfile = Tempfile.new([ "audio", extension ])
      tempfile.binmode
      tempfile.write(@audio_file.download)
      tempfile.rewind
      tempfile
    rescue StandardError => e
      Rails.logger.error("Failed to download audio: #{e.message}")
      nil
    end

    def ensure_wav_format(tempfile)
      extension = File.extname(tempfile.path).downcase

      # If already WAV, still convert to ensure correct format (16kHz mono)
      wav_tempfile = Tempfile.new([ "audio_converted", ".wav" ])

      command = [
        "ffmpeg", "-y", "-i", tempfile.path,
        "-ar", "16000",      # Whisper expects 16kHz
        "-ac", "1",          # Mono audio
        "-c:a", "pcm_s16le", # 16-bit PCM
        wav_tempfile.path
      ]

      stdout, stderr, status = Open3.capture3(*command)

      unless status.success?
        raise "FFmpeg conversion failed: #{stderr}"
      end

      wav_tempfile
    end

    def run_whisper(audio_path)
      # whisper-cpp outputs to stdout with --output-txt flag
      # We'll capture the output directly
      command = build_whisper_command(audio_path)

      Rails.logger.info("Running Whisper: #{command.join(' ')}")

      transcript = nil
      Timeout.timeout(TIMEOUT_SECONDS) do
        stdout, stderr, status = Open3.capture3(*command)

        unless status.success?
          Rails.logger.error("Whisper stderr: #{stderr}")
          raise "Whisper transcription failed: #{stderr}"
        end

        transcript = clean_transcript(stdout)
      end

      transcript
    end

    def build_whisper_command(input_path)
      [
        WhisperConfig.binary_path,
        "-m", WhisperConfig.model_path.to_s,
        "-f", input_path,
        "-l", @language,
        "-t", WhisperConfig.threads.to_s,
        "-nt",  # No timestamps
        "-np"   # No prints (cleaner output, only transcript)
      ]
    end

    def clean_transcript(text)
      # Remove any remaining timestamp markers and clean up whitespace
      text.gsub(/\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, "")
          .gsub(/\[.*?\]\s*/, "")
          .gsub(/\n+/, " ")
          .strip
    end

    def cleanup_tempfiles(*files)
      files.compact.uniq.each do |file|
        file.close rescue nil
        file.unlink rescue nil
      end
    end
  end
end
