class TaskBoardsController < ApplicationController
  before_action :set_project
  before_action :set_task_board, only: [:show, :edit, :update, :destroy]

  def show
    @columns = @task_board.task_columns.includes(tasks: [:assigned_to, :labels]).order(:position)
  end

  def new
    @task_board = @project.task_boards.build
  end

  def edit
  end

  def create
    @task_board = @project.task_boards.build(task_board_params)

    if @task_board.save
      # Create default columns
      ["To Do", "In Progress", "Review", "Done"].each_with_index do |col_name, idx|
        @task_board.task_columns.create!(name: col_name, position: idx)
      end

      respond_to do |format|
        format.html { redirect_to project_task_board_path(@project, @task_board), notice: "Board was successfully created." }
        format.turbo_stream
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @task_board.update(task_board_params)
      respond_to do |format|
        format.html { redirect_to project_task_board_path(@project, @task_board), notice: "Board was successfully updated." }
        format.turbo_stream
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @task_board.destroy
    respond_to do |format|
      format.html { redirect_to project_path(@project), notice: "Board was successfully deleted." }
      format.turbo_stream
    end
  end

  private

  def set_project
    @project = Project.find(params[:project_id])
  end

  def set_task_board
    @task_board = @project.task_boards.find(params[:id])
  end

  def task_board_params
    params.require(:task_board).permit(:name)
  end
end
