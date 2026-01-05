class ServicesController < ApplicationController
  before_action :require_admin!, except: [:index, :show]
  before_action :set_service, only: [:show, :edit, :update, :destroy]

  def index
    @services = Service.active.order(:category, :name)
  end

  def show
  end

  def new
    @service = Service.new
  end

  def edit
  end

  def create
    @service = Service.new(service_params)

    if @service.save
      respond_to do |format|
        format.html { redirect_to services_path, notice: "Service was successfully created." }
        format.turbo_stream
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @service.update(service_params)
      respond_to do |format|
        format.html { redirect_to services_path, notice: "Service was successfully updated." }
        format.turbo_stream
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @service.update!(active: false)
    respond_to do |format|
      format.html { redirect_to services_path, notice: "Service was successfully deactivated." }
      format.turbo_stream
    end
  end

  private

  def set_service
    @service = Service.find(params[:id])
  end

  def service_params
    params.require(:service).permit(:name, :code, :description, :category, :unit_price, :unit_type, :active)
  end
end
