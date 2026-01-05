class Interaction < ApplicationRecord
  belongs_to :user
  belongs_to :organization, optional: true
  belongs_to :contact, optional: true
  belongs_to :deal, optional: true

  enum :interaction_type, { call: 0, email: 1, meeting: 2, note: 3 }

  validates :interaction_type, presence: true

  scope :pending_follow_ups, -> {
    where(follow_up_completed: false)
      .where.not(follow_up_date: nil)
      .where("follow_up_date <= ?", Date.current)
  }

  scope :upcoming_follow_ups, -> {
    where(follow_up_completed: false)
      .where.not(follow_up_date: nil)
      .where("follow_up_date > ? AND follow_up_date <= ?", Date.current, 7.days.from_now)
  }

  scope :recent, -> { order(occurred_at: :desc) }

  before_validation :set_occurred_at, on: :create

  def complete_follow_up!
    update!(follow_up_completed: true)
  end

  def overdue_follow_up?
    follow_up_date && !follow_up_completed && follow_up_date < Date.current
  end

  private

  def set_occurred_at
    self.occurred_at ||= Time.current
  end
end
