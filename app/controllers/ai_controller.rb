class AiController < ApplicationController
  before_action :ensure_ai_configured

  def summarize_notes
    notes = Note.where(notable_type: params[:notable_type], notable_id: params[:notable_id])

    if notes.empty?
      render json: { error: "No notes found" }, status: :not_found
      return
    end

    result = Ai::NoteSummarizer.new(notes).call

    if result.success?
      render json: { summary: result.summary }
    else
      render json: { error: result.error }, status: :unprocessable_entity
    end
  end

  def draft_email
    interaction = Interaction.find(params[:interaction_id])
    result = Ai::EmailDrafter.new(interaction).call

    if result.success?
      render json: { draft: result.draft }
    else
      render json: { error: result.error }, status: :unprocessable_entity
    end
  end

  def analyze_scope
    content = params[:content]

    if content.blank?
      render json: { error: "Content is required" }, status: :bad_request
      return
    end

    result = Ai::ScopeAnalyzer.new(content).call

    if result.success?
      render json: { analysis: result.analysis }
    else
      render json: { error: result.error }, status: :unprocessable_entity
    end
  end

  private

  def ensure_ai_configured
    unless AiProvider.active.exists?
      render json: { error: "No AI provider configured" }, status: :service_unavailable
    end
  end
end
