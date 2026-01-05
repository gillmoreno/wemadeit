class UsersController < ApplicationController
  before_action :require_admin!
  before_action :set_user, only: [:show, :edit, :update, :destroy]

  def index
    @users = User.order(:name)
  end

  def show
    @recent_activity = @user.sessions.order(created_at: :desc).limit(10)
  end

  def new
    @user = User.new
  end

  def edit
  end

  def create
    @user = User.new(user_params)

    if @user.save
      redirect_to users_path, notice: "User was successfully created."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    update_params = user_params
    update_params = update_params.except(:password, :password_confirmation) if update_params[:password].blank?

    if @user.update(update_params)
      redirect_to users_path, notice: "User was successfully updated."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    if @user == current_user
      redirect_to users_path, alert: "You cannot delete your own account."
    else
      @user.destroy
      redirect_to users_path, notice: "User was successfully deleted."
    end
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:name, :email_address, :password, :password_confirmation, :role)
  end
end
