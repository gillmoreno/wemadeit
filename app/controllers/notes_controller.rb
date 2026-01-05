class NotesController < ApplicationController
  before_action :set_note, only: [:show, :edit, :update, :destroy]

  def index
    @notes = Note.includes(:user, :notable).order(created_at: :desc).page(params[:page])
  end

  def show
  end

  def new
    @note = Note.new
    @note.notable_type = params[:notable_type]
    @note.notable_id = params[:notable_id]
  end

  def edit
  end

  def create
    @note = Note.new(note_params)
    @note.user = current_user

    if @note.save
      respond_to do |format|
        format.html { redirect_back fallback_location: notes_path, notice: "Note was successfully created." }
        format.turbo_stream
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @note.update(note_params)
      respond_to do |format|
        format.html { redirect_back fallback_location: notes_path, notice: "Note was successfully updated." }
        format.turbo_stream
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @note.destroy
    respond_to do |format|
      format.html { redirect_back fallback_location: notes_path, notice: "Note was successfully deleted." }
      format.turbo_stream
    end
  end

  private

  def set_note
    @note = Note.find(params[:id])
  end

  def note_params
    params.require(:note).permit(:notable_type, :notable_id, :title, :content)
  end
end
