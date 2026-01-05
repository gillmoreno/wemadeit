class ProjectMembersController < ApplicationController
  before_action :require_can_manage_projects!
  before_action :set_project
  before_action :set_project_member, only: [:update, :destroy]

  def create
    @project_member = @project.project_members.build(project_member_params)

    if @project_member.save
      respond_to do |format|
        format.html { redirect_to project_path(@project), notice: "Team member was successfully added." }
        format.turbo_stream
      end
    else
      redirect_to project_path(@project), alert: @project_member.errors.full_messages.to_sentence
    end
  end

  def update
    if @project_member.update(project_member_params)
      respond_to do |format|
        format.html { redirect_to project_path(@project), notice: "Team member was successfully updated." }
        format.turbo_stream
      end
    else
      redirect_to project_path(@project), alert: @project_member.errors.full_messages.to_sentence
    end
  end

  def destroy
    @project_member.destroy
    respond_to do |format|
      format.html { redirect_to project_path(@project), notice: "Team member was successfully removed." }
      format.turbo_stream
    end
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_project_member
    @project_member = @project.project_members.find(params[:id])
  end

  def project_member_params
    params.require(:project_member).permit(:user_id, :role)
  end
end
