class SessionsController < ApplicationController
  allow_unauthenticated_access only: [:new, :create]
  rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_session_url, alert: "Try again later." }

  def new
  end

  def create
    if user = User.find_by(email_address: params[:email_address])&.authenticate(params[:password])
      start_new_session_for user
      redirect_to after_authentication_url, notice: "Welcome back, #{user.name}!"
    else
      redirect_to new_session_path, alert: "Invalid email or password."
    end
  end

  def destroy
    terminate_session
    redirect_to new_session_path, notice: "You have been signed out."
  end
end
