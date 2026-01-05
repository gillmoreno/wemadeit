module Ai
  class EmailDrafter < BaseService
    def initialize(interaction)
      super()
      @interaction = interaction
    end

    def call
      return failure("No interaction provided") unless @interaction

      context = build_context

      system_prompt = <<~PROMPT
        You are a helpful assistant that drafts professional follow-up emails for a software development company.
        Write emails that are professional, friendly, and action-oriented.
        Keep emails concise but complete. Use a warm but business-appropriate tone.
      PROMPT

      prompt = <<~PROMPT
        Please draft a follow-up email based on this interaction:

        Contact: #{@interaction.contact&.name}
        Company: #{@interaction.contact&.organization&.name}
        Interaction Type: #{@interaction.interaction_type}
        Date: #{@interaction.interaction_date&.strftime('%Y-%m-%d')}
        Subject: #{@interaction.subject}
        Description: #{@interaction.description}

        #{context}

        Follow-up Notes: #{@interaction.follow_up_notes}

        Please draft a professional follow-up email that:
        1. References our previous conversation
        2. Addresses any follow-up items
        3. Proposes next steps
        4. Has a clear call to action
      PROMPT

      result = generate_completion(prompt, system_prompt: system_prompt)

      if result.success?
        Result.new(success?: true, data: nil, error: nil).tap do |r|
          r.define_singleton_method(:draft) { result.data }
        end
      else
        result
      end
    end

    private

    def build_context
      return "" unless @interaction.deal

      <<~CONTEXT
        Deal Context:
        - Deal: #{@interaction.deal.title}
        - Value: #{@interaction.deal.value} #{@interaction.deal.currency}
        - Stage: #{@interaction.deal.pipeline_stage&.name}
      CONTEXT
    end
  end
end
