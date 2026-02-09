class AccountController < ApplicationController
  def edit
    @user = current_user
  end

  def update
    @user = current_user

    update_params = account_params
    update_params = update_params.except(:password, :password_confirmation) if update_params[:password].blank?

    if @user.update(update_params)
      redirect_to edit_account_path, notice: "Password updated successfully."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def account_params
    params.require(:user).permit(:password, :password_confirmation)
  end
end
