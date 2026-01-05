class DashboardController < ApplicationController
  def index
    @pipeline_stats = Deal.group(:status).count
    @open_deals_value = Deal.open.sum(:value)
    @recent_deals = Deal.includes(:organization, :assigned_to).order(created_at: :desc).limit(5)

    @upcoming_follow_ups = Interaction
      .where(follow_up_completed: false)
      .where("follow_up_date <= ?", 1.week.from_now)
      .order(:follow_up_date)
      .limit(10)

    @active_projects = Project.active.includes(:organization).limit(5)
    @pending_quotations = Quotation.pending.count

    @my_tasks = Task.where(assigned_to: current_user).where.not(task_column: TaskColumn.where(name: "Done")).limit(10)
  end
end
