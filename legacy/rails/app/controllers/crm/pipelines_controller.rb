module Crm
  class PipelinesController < ApplicationController
    before_action :require_admin!
    before_action :set_pipeline, only: [:show, :edit, :update, :destroy]

    def index
      @pipelines = Pipeline.all.order(:name)
    end

    def show
      @stages = @pipeline.pipeline_stages.order(:position)
    end

    def new
      @pipeline = Pipeline.new
    end

    def edit
    end

    def create
      @pipeline = Pipeline.new(pipeline_params)

      if @pipeline.save
        redirect_to crm_pipeline_path(@pipeline), notice: "Pipeline was successfully created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def update
      if @pipeline.update(pipeline_params)
        redirect_to crm_pipeline_path(@pipeline), notice: "Pipeline was successfully updated."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      if @pipeline.default?
        redirect_to crm_pipelines_path, alert: "Cannot delete the default pipeline."
      else
        @pipeline.destroy
        redirect_to crm_pipelines_path, notice: "Pipeline was successfully deleted."
      end
    end

    private

    def set_pipeline
      @pipeline = Pipeline.find(params[:id])
    end

    def pipeline_params
      params.require(:pipeline).permit(:name, :description, :default)
    end
  end
end
