class PublicQuotationsController < ApplicationController
  allow_unauthenticated_access
  layout "public"

  before_action :set_quotation

  def show
    @quotation.mark_as_viewed!
  end

  def accept
    if @quotation.can_be_signed?
      @signature = @quotation.build_signature(signature_params)
      @signature.signed_at = Time.current
      @signature.signer_ip = request.remote_ip
      @signature.user_agent = request.user_agent

      if @signature.save
        @quotation.accepted!
        # QuotationMailer.accepted(@quotation).deliver_later
        redirect_to public_quotation_path(@quotation.public_token), notice: "Thank you! The quotation has been accepted."
      else
        render :show, status: :unprocessable_entity
      end
    else
      redirect_to public_quotation_path(@quotation.public_token), alert: "This quotation cannot be signed."
    end
  end

  private

  def set_quotation
    @quotation = Quotation.find_by!(public_token: params[:token])
  end

  def signature_params
    params.require(:signature).permit(:signer_name, :signer_email, :signature_data, :signature_type)
  end
end
