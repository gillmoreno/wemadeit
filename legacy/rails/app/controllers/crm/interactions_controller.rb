module Crm
  class InteractionsController < ApplicationController
    before_action :set_interaction, only: [:show, :edit, :update, :destroy, :complete_follow_up]

    def index
      @interactions = Interaction.includes(:contact, :deal, :user, :organization)
        .order(occurred_at: :desc)
        .page(params[:page])

      @pending_follow_ups = Interaction
        .where(follow_up_completed: false)
        .where.not(follow_up_date: nil)
        .order(:follow_up_date)
    end

    def show
    end

    def new
      @interaction = Interaction.new
      @interaction.contact_id = params[:contact_id] if params[:contact_id]
      @interaction.deal_id = params[:deal_id] if params[:deal_id]
      @interaction.organization_id = params[:organization_id] if params[:organization_id]
      @interaction.occurred_at = Time.current.change(sec: 0)
    end

    def edit
    end

    def create
      @interaction = Interaction.new(interaction_params)
      @interaction.user = current_user

      if @interaction.save
        respond_to do |format|
          format.html { redirect_to crm_interaction_path(@interaction), notice: "Interaction was successfully recorded." }
          format.turbo_stream
        end
      else
        render :new, status: :unprocessable_entity
      end
    end

    def update
      if @interaction.update(interaction_params)
        respond_to do |format|
          format.html { redirect_to crm_interaction_path(@interaction), notice: "Interaction was successfully updated." }
          format.turbo_stream
        end
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      @interaction.destroy
      respond_to do |format|
        format.html { redirect_to crm_interactions_path, notice: "Interaction was successfully deleted." }
        format.turbo_stream
      end
    end

    def complete_follow_up
      @interaction.update!(follow_up_completed: true)
      respond_to do |format|
        format.html { redirect_back fallback_location: crm_interactions_path, notice: "Follow-up marked as complete." }
        format.turbo_stream
      end
    end

    private

    def set_interaction
      @interaction = Interaction.find(params[:id])
    end

    def interaction_params
      params.require(:interaction).permit(
        :contact_id, :deal_id, :organization_id, :interaction_type, :occurred_at,
        :subject, :body, :follow_up_date, :follow_up_notes, :follow_up_completed,
        :duration_minutes, :audio_file, :transcript, :transcription_language
      )
    end
  end
end
