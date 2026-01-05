class PipelineStage < ApplicationRecord
  belongs_to :pipeline
  has_many :deals, dependent: :restrict_with_error

  validates :name, presence: true
  validates :position, presence: true, numericality: { only_integer: true }

  default_scope { order(:position) }

  def won?
    name.downcase == "won"
  end

  def lost?
    name.downcase == "lost"
  end
end
