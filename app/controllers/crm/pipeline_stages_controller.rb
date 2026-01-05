module Crm
  class PipelineStagesController < ApplicationController
    before_action :require_admin!
    before_action :set_pipeline
    before_action :set_stage, only: [:edit, :update, :destroy, :move]

    def new
      @stage = @pipeline.pipeline_stages.build
    end

    def edit
    end

    def create
      @stage = @pipeline.pipeline_stages.build(stage_params)
      @stage.position = @pipeline.pipeline_stages.maximum(:position).to_i + 1

      if @stage.save
        redirect_to crm_pipeline_path(@pipeline), notice: "Stage was successfully created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def update
      if @stage.update(stage_params)
        redirect_to crm_pipeline_path(@pipeline), notice: "Stage was successfully updated."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      if @stage.deals.any?
        redirect_to crm_pipeline_path(@pipeline), alert: "Cannot delete stage with deals. Move or delete deals first."
      else
        @stage.destroy
        redirect_to crm_pipeline_path(@pipeline), notice: "Stage was successfully deleted."
      end
    end

    def move
      @stage.update!(position: params[:position].to_i)
      head :ok
    end

    private

    def set_pipeline
      @pipeline = Pipeline.find(params[:pipeline_id])
    end

    def set_stage
      @stage = @pipeline.pipeline_stages.find(params[:id])
    end

    def stage_params
      params.require(:pipeline_stage).permit(:name, :color, :probability, :position)
    end
  end
end
