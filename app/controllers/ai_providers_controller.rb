class AiProvidersController < ApplicationController
  before_action :require_admin!
  before_action :set_ai_provider, only: [:show, :edit, :update, :destroy]

  def index
    @ai_providers = AiProvider.order(:name)
  end

  def show
  end

  def new
    @ai_provider = AiProvider.new
  end

  def edit
  end

  def create
    @ai_provider = AiProvider.new(ai_provider_params)

    if @ai_provider.save
      redirect_to ai_providers_path, notice: "AI Provider was successfully created."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @ai_provider.update(ai_provider_params)
      redirect_to ai_providers_path, notice: "AI Provider was successfully updated."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @ai_provider.destroy
    redirect_to ai_providers_path, notice: "AI Provider was successfully deleted."
  end

  private

  def set_ai_provider
    @ai_provider = AiProvider.find(params[:id])
  end

  def ai_provider_params
    params.require(:ai_provider).permit(
      :name,
      :model,
      :api_key_encrypted,
      :active,
      :default,
      :base_url,
      :stt_model
    )
  end
end
