class TasksController < ApplicationController
  before_action :set_task, only: [:show, :edit, :update, :destroy, :move]

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
      respond_to do |format|
        format.html { redirect_to task_path(@task), notice: "Task was successfully created." }
        format.turbo_stream
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      respond_to do |format|
        format.html { redirect_to task_path(@task), notice: "Task was successfully updated." }
        format.turbo_stream
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @task.destroy
    respond_to do |format|
      format.html { redirect_to tasks_path, notice: "Task was successfully deleted." }
      format.turbo_stream
    end
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

  def task_params
    params.require(:task).permit(
      :task_column_id, :title, :description, :priority,
      :due_date, :estimated_hours, :actual_hours,
      :assigned_to_id, label_ids: []
    )
  end
end
