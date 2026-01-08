module Ai
  class BaseService
    Result = Struct.new(:success?, :data, :error, keyword_init: true)

    def initialize
      @provider = AiProvider.active.first
    end

    def call
      raise NotImplementedError, "Subclasses must implement #call"
    end

    protected

    def success(data)
      Result.new(success?: true, data: data, error: nil)
    end

    def failure(error)
      Result.new(success?: false, data: nil, error: error)
    end

    def client
      @client ||= build_client
    end

    def build_client
      return nil unless @provider

      case @provider.provider_type
      when "anthropic"
        Anthropic::Client.new(api_key: @provider.api_key)
      when "openai"
        OpenAI::Client.new(access_token: @provider.api_key)
      when "groq"
        OpenAI::Client.new(
          access_token: @provider.api_key,
          uri_base: "https://api.groq.com/openai/v1"
        )
      else
        nil
      end
    end

    def generate_completion(prompt, system_prompt: nil)
      return failure("No AI provider configured") unless @provider && client

      case @provider.provider_type
      when "anthropic"
        generate_anthropic_completion(prompt, system_prompt)
      when "openai", "groq"
        generate_openai_completion(prompt, system_prompt)
      else
        failure("Unsupported provider type")
      end
    rescue StandardError => e
      failure("AI request failed: #{e.message}")
    end

    private

    def generate_anthropic_completion(prompt, system_prompt)
      messages = [{ role: "user", content: prompt }]

      response = client.messages(
        model: @provider.model_name || "claude-3-haiku-20240307",
        max_tokens: 4096,
        system: system_prompt,
        messages: messages
      )

      content = response.dig("content", 0, "text")
      success(content)
    end

    def generate_openai_completion(prompt, system_prompt)
      messages = []
      messages << { role: "system", content: system_prompt } if system_prompt
      messages << { role: "user", content: prompt }

      response = client.chat(
        parameters: {
          model: @provider.model_name || "gpt-4o-mini",
          messages: messages,
          max_tokens: 4096
        }
      )

      content = response.dig("choices", 0, "message", "content")
      success(content)
    end
  end
end
