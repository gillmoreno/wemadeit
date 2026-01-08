class QuotationsController < ApplicationController
  before_action :require_can_manage_quotations!, except: [:index, :show]
  before_action :set_quotation, only: [:show, :edit, :update, :destroy, :preview, :send_to_client, :duplicate, :convert_to_project]

  def index
    @quotations = Quotation.includes(deal: [:organization, :contact], created_by: [])
      .order(created_at: :desc)
      .page(params[:page])

    @quotations = @quotations.where(status: params[:status]) if params[:status].present?
  end

  def show
    @items = @quotation.quotation_items.includes(:service).order(:position)
  end

  def new
    @quotation = Quotation.new
    @quotation.deal_id = params[:deal_id] if params[:deal_id]
    @quotation.valid_until = 30.days.from_now
    @quotation.tax_rate = 22.0 # Default VAT
  end

  def edit
    @items = @quotation.quotation_items.includes(:service).order(:position)
  end

  def create
    @quotation = Quotation.new(quotation_params)
    @quotation.created_by = current_user

    if @quotation.save
      respond_to do |format|
        format.html { redirect_to quotation_path(@quotation), notice: "Quotation was successfully created." }
        format.turbo_stream
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @quotation.update(quotation_params)
      respond_to do |format|
        format.html { redirect_to quotation_path(@quotation), notice: "Quotation was successfully updated." }
        format.turbo_stream
      end
    else
      @items = @quotation.quotation_items.includes(:service).order(:position)
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @quotation.destroy
    respond_to do |format|
      format.html { redirect_to quotations_path, notice: "Quotation was successfully deleted." }
      format.turbo_stream
    end
  end

  def preview
    respond_to do |format|
      format.html
      format.pdf do
        pdf = QuotationPdf.new(@quotation)
        send_data pdf.render,
          filename: "quotation-#{@quotation.number}.pdf",
          type: "application/pdf",
          disposition: "inline"
      end
    end
  end

  def send_to_client
    if @quotation.draft?
      @quotation.sent!
      # QuotationMailer.send_to_client(@quotation).deliver_later
      redirect_to quotation_path(@quotation), notice: "Quotation has been sent to the client."
    else
      redirect_to quotation_path(@quotation), alert: "Quotation has already been sent."
    end
  end

  def duplicate
    new_quotation = @quotation.duplicate
    if new_quotation.save
      redirect_to edit_quotation_path(new_quotation), notice: "Quotation duplicated. You can now edit the new quotation."
    else
      redirect_to quotation_path(@quotation), alert: "Could not duplicate quotation."
    end
  end

  def convert_to_project
    if @quotation.accepted?
      project = @quotation.convert_to_project!
      if project.persisted?
        redirect_to project_path(project), notice: "Project created from quotation."
      else
        redirect_to quotation_path(@quotation), alert: "Could not create project: #{project.errors.full_messages.to_sentence}"
      end
    else
      redirect_to quotation_path(@quotation), alert: "Only accepted quotations can be converted to projects."
    end
  end

  private

  def set_quotation
    @quotation = Quotation.find(params[:id])
  end

  def quotation_params
    params.require(:quotation).permit(
      :deal_id,
      :subject, :introduction, :terms, :valid_until,
      :tax_rate, :discount_amount, :discount_percentage, :currency,
      quotation_items_attributes: [
        :id, :service_id, :name, :description, :quantity, :unit_price, :unit_type, :position, :_destroy
      ]
    )
  end
end
