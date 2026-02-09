class TasksController < ApplicationController
  before_action :set_task, only: [:show, :edit, :update, :destroy, :move]
  before_action :set_form_data, only: [:new, :edit]

  def index
    @tasks = Task.includes(:task_column, :assigned_to, :labels)
      .order(created_at: :desc)
      .page(params[:page])

    @tasks = @tasks.where(assigned_to: current_user) if params[:mine] == "true"
  end

  def show
  end

  def new
    @task = Task.new
    @task.task_column_id = params[:column_id] if params[:column_id]
  end

  def edit
  end

  def create
    @task = Task.new(task_params)
    @task.created_by = current_user
    @task.position = Task.where(task_column_id: @task.task_column_id).maximum(:position).to_i + 1

    if @task.save
      redirect_to task_path(@task), notice: "Task was successfully created."
    else
      set_form_data
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      redirect_to task_path(@task), notice: "Task was successfully updated."
    else
      set_form_data
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    task_board = @task.task_board
    project = task_board.project
    @task.destroy
    redirect_to project_task_board_path(project, task_board), notice: "Task was successfully deleted."
  end

  def move
    @task.update!(
      task_column_id: params[:column_id],
      position: params[:position].to_i
    )
    head :ok
  end

  private

  def set_task
    @task = Task.find(params[:id])
  end

  def set_form_data
    # Get columns from the task's board or from the column_id param
    if @task&.persisted?
      @task_board = @task.task_board
    elsif params[:column_id].present?
      column = TaskColumn.find(params[:column_id])
      @task_board = column.task_board
    end

    if @task_board
      @columns = @task_board.task_columns.order(:position)
      @back_path = project_task_board_path(@task_board.project, @task_board)
    else
      @columns = TaskColumn.includes(:task_board).order(:position)
      @back_path = tasks_path
    end

    @labels = Label.order(:name)
  end

  def task_params
    params.require(:task).permit(
      :task_column_id, :title, :description, :priority,
      :due_date, :estimated_hours, :actual_hours,
      :assigned_to_id, label_ids: []
    )
  end
end
