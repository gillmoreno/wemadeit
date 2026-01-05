module Crm
  class ContactsController < ApplicationController
    before_action :set_contact, only: [:show, :edit, :update, :destroy]

    def index
      @contacts = Contact.includes(:organization)
        .order(created_at: :desc)
        .page(params[:page])
    end

    def show
      @interactions = @contact.interactions.order(interaction_date: :desc)
      @notes = @contact.notes.order(created_at: :desc)
    end

    def new
      @contact = Contact.new
      @contact.organization_id = params[:organization_id] if params[:organization_id]
    end

    def edit
    end

    def create
      @contact = Contact.new(contact_params)

      if @contact.save
        redirect_to crm_contact_path(@contact), notice: "Contact was successfully created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def update
      if @contact.update(contact_params)
        redirect_to crm_contact_path(@contact), notice: "Contact was successfully updated."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      @contact.destroy
      redirect_to crm_contacts_path, notice: "Contact was successfully deleted."
    end

    private

    def set_contact
      @contact = Contact.find(params[:id])
    end

    def contact_params
      params.require(:contact).permit(:organization_id, :first_name, :last_name, :email, :phone, :job_title, :primary_contact, :memo)
    end
  end
end
