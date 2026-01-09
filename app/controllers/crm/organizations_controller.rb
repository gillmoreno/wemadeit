module Crm
  class OrganizationsController < ApplicationController
    before_action :set_organization, only: [:show, :edit, :update, :destroy]

    def index
      @organizations = Organization.includes(:contacts, deals: :project)
        .order(created_at: :desc)
        .page(params[:page])
    end

    def show
      @contacts = @organization.contacts.order(:first_name, :last_name)
      @deals = @organization.deals.includes(:pipeline_stage, :assigned_to).order(created_at: :desc)
      @projects = @organization.projects.order(created_at: :desc)
      @quotations = @organization.quotations.order(created_at: :desc)
    end

    def new
      @organization = Organization.new
    end

    def edit
    end

    def create
      @organization = Organization.new(organization_params)

      if @organization.save
        redirect_to crm_organization_path(@organization), notice: "Organization was successfully created."
      else
        render :new, status: :unprocessable_entity
      end
    end

    def update
      if @organization.update(organization_params)
        redirect_to crm_organization_path(@organization), notice: "Organization was successfully updated."
      else
        render :edit, status: :unprocessable_entity
      end
    end

    def destroy
      @organization.destroy
      redirect_to crm_organizations_path, notice: "Organization was successfully deleted."
    end

    private

    def set_organization
      @organization = Organization.find(params[:id])
    end

    def organization_params
      params.require(:organization).permit(:name, :industry, :website, :phone, :email, :address, :city, :country, :notes)
    end
  end
end
