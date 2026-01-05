module Ai
  class ScopeAnalyzer < BaseService
    def initialize(content)
      super()
      @content = content
    end

    def call
      return failure("No content to analyze") if @content.blank?

      system_prompt = <<~PROMPT
        You are a senior software architect and project manager at a software development company.
        You analyze project requirements and provide structured estimates and risk assessments.
        Be realistic and thorough. Consider all aspects of software development.
      PROMPT

      prompt = <<~PROMPT
        Please analyze the following project requirements/scope:

        #{@content}

        Provide a structured analysis including:

        1. **Project Summary**
           - Brief overview of what's being requested
           - Target users and main value proposition

        2. **Technical Scope**
           - Core features (must-have)
           - Nice-to-have features
           - Technical stack recommendations

        3. **Effort Estimation**
           - Breakdown by component/feature
           - Total estimated development time (in days/weeks)
           - Team composition recommendation

        4. **Risk Assessment**
           - Technical risks
           - Scope risks
           - Timeline risks
           - Mitigation strategies

        5. **Questions & Clarifications**
           - What additional information is needed?
           - What assumptions have you made?

        6. **Recommended Approach**
           - Suggested phases/milestones
           - MVP scope recommendation
      PROMPT

      result = generate_completion(prompt, system_prompt: system_prompt)

      if result.success?
        Result.new(success?: true, data: nil, error: nil).tap do |r|
          r.define_singleton_method(:analysis) { result.data }
        end
      else
        result
      end
    end
  end
end
