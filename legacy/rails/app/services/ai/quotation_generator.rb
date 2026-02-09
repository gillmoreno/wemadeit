module Ai
  class QuotationGenerator < BaseService
    def initialize(requirements_text, organization:, services: [])
      super()
      @requirements = requirements_text
      @organization = organization
      @services = services
    end

    def call
      return failure("No requirements provided") if @requirements.blank?
      return failure("No organization provided") unless @organization

      system_prompt = build_system_prompt
      prompt = build_prompt

      result = generate_completion(prompt, system_prompt: system_prompt)

      if result.success?
        parse_response(result.data)
      else
        result
      end
    end

    private

    def build_system_prompt
      <<~PROMPT
        You are a senior project manager at a software development company creating quotations.
        You analyze project requirements and create detailed, accurate quotations with line items.

        The requirements may be in Italian. Extract and understand them regardless of language.
        Generate output in English for the quotation structure.

        Your responses must be valid JSON only, with no additional text or markdown.

        Guidelines for pricing (EUR):
        - Development work: 600-1200 per day depending on complexity
        - Design work: 500-800 per day
        - Project management: 10-15% of development cost
        - Testing/QA: 15-20% of development cost
        - Consider complexity, integrations, and risk factors

        Guidelines for estimation:
        - Break down into logical deliverables
        - Include setup, development, testing, deployment phases
        - Account for project management overhead
        - Be realistic about timelines
      PROMPT
    end

    def build_prompt
      services_context = build_services_context

      <<~PROMPT
        Analyze the following project requirements and generate a quotation:

        Organization: #{@organization.name}
        Industry: #{@organization.industry || "Not specified"}

        #{services_context}

        PROJECT REQUIREMENTS:
        ---
        #{@requirements}
        ---

        Generate a JSON response with this exact structure:
        {
          "deal": {
            "title": "Short descriptive title for the deal (max 100 chars)",
            "description": "Brief project description (2-3 sentences)",
            "estimated_value": <total estimated value as number>
          },
          "quotation": {
            "title": "Quotation title",
            "introduction": "Professional introduction paragraph for the client"
          },
          "items": [
            {
              "name": "Line item name",
              "description": "Detailed description of deliverable",
              "quantity": <number, typically 1 for fixed price or hours/days>,
              "unit_price": <price per unit as number>,
              "unit_type": "fixed|hour|day|month"
            }
          ]
        }

        Important:
        - Provide 3-10 line items covering major deliverables
        - Prices should be in EUR
        - Each item should be a distinct deliverable or service
        - Include project management and QA as separate items
        - Be specific in descriptions - avoid generic terms
        - Return ONLY valid JSON, no other text
      PROMPT
    end

    def build_services_context
      return "" if @services.empty?

      service_list = @services.map do |s|
        "- #{s.name}: EUR #{s.unit_price}/#{s.unit_type}"
      end.join("\n")

      <<~CONTEXT
        Reference pricing from our service catalog:
        #{service_list}

      CONTEXT
    end

    def parse_response(response_text)
      cleaned = response_text.strip
      cleaned = cleaned.gsub(/^```json\s*/, "").gsub(/```\s*$/, "")

      begin
        data = JSON.parse(cleaned)
        validate_response_structure(data)
        success(data)
      rescue JSON::ParserError => e
        failure("Failed to parse AI response as JSON: #{e.message}")
      rescue ArgumentError => e
        failure("Invalid response structure: #{e.message}")
      end
    end

    def validate_response_structure(data)
      raise ArgumentError, "Missing 'deal' section" unless data["deal"]
      raise ArgumentError, "Missing 'quotation' section" unless data["quotation"]
      raise ArgumentError, "Missing 'items' array" unless data["items"].is_a?(Array)
      raise ArgumentError, "No items generated" if data["items"].empty?

      data["items"].each_with_index do |item, idx|
        raise ArgumentError, "Item #{idx + 1} missing 'name'" unless item["name"]
        raise ArgumentError, "Item #{idx + 1} missing 'unit_price'" unless item["unit_price"]
      end
    end
  end
end
