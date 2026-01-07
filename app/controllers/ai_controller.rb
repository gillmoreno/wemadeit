class AiController < ApplicationController
  before_action :ensure_ai_configured, except: [:transcribe_audio]
  before_action :ensure_transcription_available, only: [:transcribe_audio]

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

  def transcribe_audio
    interaction = Interaction.find(params[:interaction_id])

    unless interaction.audio_file.attached?
      render json: { error: "No audio file attached" }, status: :bad_request
      return
    end

    interaction.update!(transcription_status: :processing)

    result = Ai::TranscriptionService.new(
      interaction.audio_file,
      language: interaction.transcription_language || "it"
    ).call

    if result.success?
      interaction.update!(
        transcript: result.data,
        transcription_status: :completed
      )
      render json: { transcript: result.data, status: "completed" }
    else
      interaction.update!(transcription_status: :failed)
      render json: { error: result.error }, status: :unprocessable_entity
    end
  end

  def clean_transcript
    interaction = Interaction.find(params[:interaction_id])
    transcript = params[:transcript].presence || interaction.transcript

    if transcript.blank?
      render json: { error: "No transcript available" }, status: :bad_request
      return
    end

    result = Ai::TranscriptCleaner.new(
      transcript,
      crm_context: interaction.crm_context
    ).call

    if result.success?
      interaction.update!(cleaned_transcript: result.data)
      render json: { cleaned_transcript: result.data }
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

  def ensure_transcription_available
    # Allow if local Whisper is available OR OpenAI is configured
    unless Ai::WhisperConfig.available? || AiProvider.where(name: "openai").active.exists?
      render json: { error: "No transcription provider available. Install whisper-cpp or configure OpenAI." }, status: :service_unavailable
    end
  end
end
