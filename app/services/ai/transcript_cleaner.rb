module Ai
  class TranscriptCleaner < BaseService
    def initialize(transcript, crm_context: {})
      super()
      @transcript = transcript
      @crm_context = crm_context
    end

    def call
      return failure("No transcript provided") if @transcript.blank?

      system_prompt = build_system_prompt
      prompt = build_prompt

      result = generate_completion(prompt, system_prompt: system_prompt)

      if result.success?
        success(result.data)
      else
        result
      end
    end

    private

    def build_system_prompt
      <<~PROMPT
        You are a professional transcript editor for a CRM system. Your task is to clean and format
        messy transcripts from calls and meetings, making them clear and actionable.

        Guidelines:
        - Remove filler words (um, uh, ehm, allora, quindi, etc.)
        - Fix punctuation and capitalization
        - Break into logical paragraphs
        - Identify and label speakers when possible (use "Speaker 1:", "Speaker 2:" or actual names if mentioned)
        - Keep the original language (do NOT translate)
        - Preserve technical terms and proper nouns accurately
        - Extract and highlight action items at the end
        - Maintain a professional tone while keeping the content accurate

        Output format:
        1. Cleaned transcript with speaker labels and paragraphs
        2. A "KEY POINTS" section summarizing main topics discussed
        3. An "ACTION ITEMS" section listing any tasks or follow-ups mentioned
      PROMPT
    end

    def build_prompt
      context_section = build_context_section

      <<~PROMPT
        #{context_section}

        Please clean and format the following transcript:

        ---
        #{@transcript}
        ---

        Provide the cleaned transcript maintaining the original language.
      PROMPT
    end

    def build_context_section
      return "" if @crm_context.blank?

      sections = []

      if @crm_context[:contact].present?
        contact = @crm_context[:contact]
        name = [ contact[:first_name], contact[:last_name] ].compact.join(" ")
        sections << "Contact: #{name} (#{contact[:email]})" if name.present?
      end

      if @crm_context[:organization].present?
        org = @crm_context[:organization]
        sections << "Organization: #{org[:name]}" if org[:name].present?
        sections << "Industry: #{org[:industry]}" if org[:industry].present?
      end

      if @crm_context[:deal].present?
        deal = @crm_context[:deal]
        sections << "Deal: #{deal[:title]} (#{deal[:status]})" if deal[:title].present?
        sections << "Value: #{deal[:value]}" if deal[:value].present?
      end

      if @crm_context[:recent_interactions].present? && @crm_context[:recent_interactions].any?
        recent = @crm_context[:recent_interactions].map do |i|
          "- #{i[:type]}: #{i[:subject]} (#{i[:occurred_at]&.to_date})"
        end.join("\n")
        sections << "Recent interactions:\n#{recent}"
      end

      return "" if sections.empty?

      <<~CONTEXT
        CRM Context (use this to better understand names, topics, and context):
        #{sections.join("\n")}

      CONTEXT
    end
  end
end
