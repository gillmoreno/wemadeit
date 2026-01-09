Rails.application.routes.draw do
  # Authentication
  resource :session, only: [:new, :create, :destroy]
  resources :passwords, param: :token, only: [:new, :create, :edit, :update]

  # Dashboard
  root "dashboard#index"

  # CRM
  namespace :crm do
    resources :organizations
    resources :contacts
    resources :deals do
      member do
        patch :move
      end
    end
    resources :pipelines do
      resources :pipeline_stages, only: [:new, :create, :edit, :update, :destroy]
    end
    resources :interactions do
      member do
        patch :complete_follow_up
      end
    end
  end

  # Projects
  resources :projects do
    member do
      post :activate
      post :complete
      post :support
    end
    resources :task_boards do
      resources :task_columns, only: [:create, :update, :destroy]
    end
    resources :project_members, only: [:create, :destroy]
  end

  resources :tasks do
    member do
      patch :move
    end
  end

  # Quotations
  resources :quotations do
    member do
      get :preview
      post :send_to_client
      post :duplicate
      post :convert_to_project
    end
    resources :quotation_items, only: [:create, :update, :destroy]
  end

  # Public quotation (no authentication required)
  get "/q/:token", to: "public_quotations#show", as: :public_quotation
  post "/q/:token/accept", to: "public_quotations#accept", as: :accept_public_quotation

  # Services catalog
  resources :services

  # Notes (polymorphic)
  resources :notes

  # AI endpoints
  post "ai/summarize_notes", to: "ai#summarize_notes"
  post "ai/draft_email", to: "ai#draft_email"
  post "ai/analyze_scope", to: "ai#analyze_scope"
  post "ai/transcribe_audio", to: "ai#transcribe_audio"
  post "ai/clean_transcript", to: "ai#clean_transcript"

  # Admin
  resources :users
  resources :ai_providers
  resources :labels

  # Health check
  get "up" => "rails/health#show", as: :rails_health_check
end
