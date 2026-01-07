module Ai
  class WhisperConfig
    DEFAULT_MODEL = "small"
    AVAILABLE_MODELS = %w[tiny base small medium large-v3].freeze

    class << self
      def model_path
        configured_path = ENV.fetch("WHISPER_MODEL_PATH") { default_model_path }
        Pathname.new(configured_path)
      end

      def model_name
        ENV.fetch("WHISPER_MODEL", DEFAULT_MODEL)
      end

      def binary_path
        ENV.fetch("WHISPER_BINARY", "whisper-cli")
      end

      def threads
        ENV.fetch("WHISPER_THREADS", 4).to_i
      end

      def enabled?
        ENV.fetch("WHISPER_LOCAL_ENABLED", "true") == "true"
      end

      # Server mode for Docker environments
      def server_mode?
        ENV.fetch("WHISPER_SERVER_URL", "").present?
      end

      def server_url
        ENV.fetch("WHISPER_SERVER_URL", "http://host.docker.internal:8080")
      end

      def available?
        return server_available? if server_mode?
        enabled? && binary_exists? && model_exists?
      end

      def server_available?
        return false unless enabled?
        uri = URI.parse(server_url)
        http = Net::HTTP.new(uri.host, uri.port)
        http.open_timeout = 2
        http.read_timeout = 2
        response = http.get("/")
        response.code == "200"
      rescue StandardError
        false
      end

      def binary_exists?
        system("which #{binary_path} > /dev/null 2>&1")
      end

      def model_exists?
        File.exist?(model_path)
      end

      private

      def default_model_path
        Rails.root.join("storage", "whisper_models", "ggml-#{model_name}.bin").to_s
      end
    end
  end
end
