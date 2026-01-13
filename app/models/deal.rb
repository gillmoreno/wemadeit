class Deal < ApplicationRecord
  belongs_to :organization
  belongs_to :contact, optional: true
  belongs_to :pipeline_stage
  belongs_to :assigned_to, class_name: "User"
  belongs_to :created_by, class_name: "User", optional: true

  has_many :interactions, dependent: :destroy
  has_many :quotations, dependent: :nullify
  has_many :notes, as: :notable, dependent: :destroy
  has_one :project, dependent: :nullify

  enum :status, { open: 0, won: 1, lost: 2 }

  validates :title, presence: true
  validates :assigned_to, presence: true

  scope :by_stage, ->(stage_id) { where(pipeline_stage_id: stage_id) }
  scope :for_user, ->(user) { where(assigned_to: user) }

  before_validation :set_default_currency, on: :create

  def pipeline
    pipeline_stage&.pipeline
  end

  def move_to_stage!(stage)
    update!(pipeline_stage: stage)
    won! if stage.won?
    lost! if stage.lost?
  end

  def weighted_value
    return 0 unless value && pipeline_stage&.probability
    value * (pipeline_stage.probability / 100.0)
  end

  def days_in_pipeline
    (Date.current - created_at.to_date).to_i
  end

  private

  def set_default_currency
    self.currency ||= "EUR"
  end
end
