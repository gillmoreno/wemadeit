module Crm
  class DealsController < ApplicationController
    before_action :require_can_manage_deals!, except: [:index, :show]
    before_action :set_deal, only: [:show, :edit, :update, :destroy, :move]

    def index
      @pipeline = Pipeline.find_by(default: true) || Pipeline.first
      @stages = @pipeline.pipeline_stages.includes(deals: [:organization, :assigned_to]).order(:position)
      @deals = Deal.includes(:organization, :pipeline_stage, :assigned_to).order(created_at: :desc)
    end

    def show
      @interactions = @deal.interactions.order(interaction_date: :desc)
      @notes = @deal.notes.order(created_at: :desc)
    end

    def new
      @deal = Deal.new
      @deal.organization_id = params[:organization_id] if params[:organization_id]
      @deal.pipeline_stage_id = params[:stage_id] if params[:stage_id]
    end

    def edit
    end

    def create
      @deal = Deal.new(deal_params)
      @deal.created_by = current_user
      @deal.assigned_to ||= current_user

      if @deal.save
        respond_to do |format|
          format.html { redirect_to crm_deal_path(@deal), notice: "Deal was successfully created." }
          format.turbo_stream
        end
      else
        render :new, status: :unprocessable_entity
      end
    end

    def update
      if @deal.update(deal_params)
        respond_to do |format|
          format.html { redirect_to crm_deal_path(@deal), notice: "Deal was successfully updated." }
          format.turbo_stream
        end
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      @deal.destroy
      respond_to do |format|
        format.html { redirect_to crm_deals_path, notice: "Deal was successfully deleted." }
        format.turbo_stream
      end
    end

    def move
      @deal.update!(pipeline_stage_id: params[:stage_id])
      head :ok
    end

    private

    def set_deal
      @deal = Deal.find(params[:id])
    end

    def deal_params
      params.require(:deal).permit(
        :title, :organization_id, :contact_id, :pipeline_stage_id,
        :value, :currency, :probability, :expected_close_date,
        :status, :assigned_to_id, :description, :source
      )
    end
  end
end
