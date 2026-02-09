class TaskColumnsController < ApplicationController
  before_action :set_project
  before_action :set_task_board
  before_action :set_task_column, only: [:update, :destroy, :move]

  def create
    @task_column = @task_board.task_columns.build(task_column_params)
    @task_column.position = @task_board.task_columns.maximum(:position).to_i + 1

    if @task_column.save
      respond_to do |format|
        format.html { redirect_to project_task_board_path(@project, @task_board), notice: "Column was successfully created." }
        format.turbo_stream
      end
    else
      redirect_to project_task_board_path(@project, @task_board), alert: @task_column.errors.full_messages.to_sentence
    end
  end

  def update
    if @task_column.update(task_column_params)
      respond_to do |format|
        format.html { redirect_to project_task_board_path(@project, @task_board), notice: "Column was successfully updated." }
        format.turbo_stream
      end
    else
      redirect_to project_task_board_path(@project, @task_board), alert: @task_column.errors.full_messages.to_sentence
    end
  end

  def destroy
    if @task_column.tasks.any?
      redirect_to project_task_board_path(@project, @task_board), alert: "Cannot delete column with tasks."
    else
      @task_column.destroy
      respond_to do |format|
        format.html { redirect_to project_task_board_path(@project, @task_board), notice: "Column was successfully deleted." }
        format.turbo_stream
      end
    end
  end

  def move
    @task_column.update!(position: params[:position].to_i)
    head :ok
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_task_board
    @task_board = @project.task_boards.find(params[:task_board_id])
  end

  def set_task_column
    @task_column = @task_board.task_columns.find(params[:id])
  end

  def task_column_params
    params.require(:task_column).permit(:name, :wip_limit)
  end
end
