module Ai
  class NoteSummarizer < BaseService
    def initialize(notes)
      super()
      @notes = notes
    end

    def call
      return failure("No notes to summarize") if @notes.empty?

      notes_text = @notes.map do |note|
        "#{note.title}\n#{note.content}\n(#{note.created_at.strftime('%Y-%m-%d')})"
      end.join("\n\n---\n\n")

      system_prompt = <<~PROMPT
        You are a helpful assistant that summarizes notes for a software development project management system.
        Create concise, actionable summaries that highlight key points, decisions, and action items.
        Use bullet points for clarity. Focus on what matters most for project progress.
      PROMPT

      prompt = <<~PROMPT
        Please summarize the following notes:

        #{notes_text}

        Provide a clear summary with:
        1. Key decisions made
        2. Important information
        3. Action items or next steps
        4. Any concerns or blockers mentioned
      PROMPT

      result = generate_completion(prompt, system_prompt: system_prompt)

      if result.success?
        Result.new(success?: true, data: nil, error: nil).tap do |r|
          r.define_singleton_method(:summary) { result.data }
        end
      else
        result
      end
    end
  end
end
