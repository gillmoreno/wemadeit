class ProjectsController < ApplicationController
  before_action :require_can_manage_projects!, except: [:index, :show]
  before_action :set_project, only: [:show, :edit, :update, :destroy, :activate, :complete, :support]

  def index
    @projects = Project.includes(deal: :organization, project_manager: [])
      .order(created_at: :desc)
      .page(params[:page])

    @projects = @projects.where(status: params[:status]) if params[:status].present?
  end

  def show
    @task_boards = @project.task_boards.includes(task_columns: :tasks)
    @team_members = @project.project_members.includes(:user)
    @notes = @project.notes.order(created_at: :desc)
  end

  def new
    @project = Project.new
    @project.deal_id = params[:deal_id] if params[:deal_id]
  end

  def edit
  end

  def create
    @project = Project.new(project_params)

    if @project.save
      # Create default task board
      board = @project.task_boards.create!(name: "Main Board")
      ["To Do", "In Progress", "Review", "Done"].each_with_index do |col_name, idx|
        board.task_columns.create!(name: col_name, position: idx)
      end

      redirect_to project_path(@project), notice: "Project was successfully created."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @project.update(project_params)
      redirect_to project_path(@project), notice: "Project was successfully updated."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @project.destroy
    redirect_to projects_path, notice: "Project was successfully deleted."
  end

  def activate
    if @project.activate!
      redirect_to project_path(@project), notice: "Project has been activated."
    else
      redirect_to project_path(@project), alert: "Could not activate project."
    end
  end

  def complete
    if @project.complete!
      redirect_to project_path(@project), notice: "Project has been marked as completed."
    else
      redirect_to project_path(@project), alert: "Could not complete project."
    end
  end

  def support
    if @project.move_to_support!
      redirect_to project_path(@project), notice: "Project has been moved to support."
    else
      redirect_to project_path(@project), alert: "Could not move project to support."
    end
  end

  private

  def set_project
    @project = Project.find(params[:id])
  end

  def project_params
    params.require(:project).permit(
      :name, :code, :deal_id, :project_type, :status,
      :start_date, :target_end_date, :actual_end_date,
      :budget, :project_manager_id, :description
    )
  end
end
