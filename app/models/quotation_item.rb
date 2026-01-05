class QuotationItem < ApplicationRecord
  belongs_to :quotation
  belongs_to :service, optional: true

  validates :name, presence: true
  validates :position, presence: true, numericality: { only_integer: true }

  before_validation :set_position, on: :create
  before_save :calculate_line_total

  def calculate_line_total
    self.line_total = (quantity || 1) * (unit_price || 0)
  end

  private

  def set_position
    self.position ||= quotation&.quotation_items&.count || 0
  end
end
