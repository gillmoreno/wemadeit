module Authorization
  extend ActiveSupport::Concern

  included do
    helper_method :admin?, :sales?, :project_manager?, :developer?,
                  :can_manage_deals?, :can_manage_projects?, :can_manage_quotations?,
                  :can_view_reports?, :can_manage_users?
  end

  # --- Role Check Helpers ---

  def admin?
    current_user&.admin?
  end

  def sales?
    current_user&.admin? || current_user&.sales?
  end

  def project_manager?
    current_user&.admin? || current_user&.project_manager?
  end

  def developer?
    current_user&.developer?
  end

  # --- Permission Check Helpers ---

  # Admin and Sales can manage deals/pipeline
  def can_manage_deals?
    admin? || sales?
  end

  # Admin and Project Manager can manage projects
  def can_manage_projects?
    admin? || project_manager?
  end

  # Admin and Sales can manage quotations
  def can_manage_quotations?
    admin? || sales?
  end

  # Admin, Sales, and Project Manager can view reports
  def can_view_reports?
    admin? || sales? || project_manager?
  end

  # Only admin can manage users
  def can_manage_users?
    admin?
  end

  # All authenticated users can view projects they're assigned to
  def can_view_projects?
    authenticated?
  end

  # All authenticated users can view tasks
  def can_view_tasks?
    authenticated?
  end

  # --- Requirement Guards (before_action filters) ---

  def require_admin!
    redirect_to root_path, alert: "Not authorized" unless admin?
  end

  def require_can_manage_deals!
    redirect_to root_path, alert: "Not authorized" unless can_manage_deals?
  end

  def require_can_manage_projects!
    redirect_to root_path, alert: "Not authorized" unless can_manage_projects?
  end

  def require_can_manage_quotations!
    redirect_to root_path, alert: "Not authorized" unless can_manage_quotations?
  end

  def require_can_view_reports!
    redirect_to root_path, alert: "Not authorized" unless can_view_reports?
  end
end
