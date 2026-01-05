class ProjectsController < ApplicationController
  before_action :require_can_manage_projects!, except: [:index, :show]
  before_action :set_project, only: [:show, :edit, :update, :destroy]

  def index
    @projects = Project.includes(:organization, :project_manager)
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
    @project.organization_id = params[:organization_id] if params[:organization_id]
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

      respond_to do |format|
        format.html { redirect_to project_path(@project), notice: "Project was successfully created." }
        format.turbo_stream
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @project.update(project_params)
      respond_to do |format|
        format.html { redirect_to project_path(@project), notice: "Project was successfully updated." }
        format.turbo_stream
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @project.destroy
    respond_to do |format|
      format.html { redirect_to projects_path, notice: "Project was successfully deleted." }
      format.turbo_stream
    end
  end

  private

  def set_project
    @project = Project.find(params[:id])
  end

  def project_params
    params.require(:project).permit(
      :name, :code, :organization_id, :project_type, :status,
      :start_date, :target_end_date, :actual_end_date,
      :budget, :hourly_rate, :project_manager_id, :description
    )
  end
end
