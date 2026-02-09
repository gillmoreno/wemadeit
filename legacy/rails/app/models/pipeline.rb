class Pipeline < ApplicationRecord
  has_many :pipeline_stages, -> { order(:position) }, dependent: :destroy
  has_many :deals, through: :pipeline_stages

  validates :name, presence: true

  scope :default_pipeline, -> { find_by(default: true) }

  def self.default
    find_by(default: true) || first
  end
end
