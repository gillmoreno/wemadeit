class Note < ApplicationRecord
  belongs_to :user
  belongs_to :notable, polymorphic: true

  has_rich_text :content

  validates :user, presence: true

  scope :recent, -> { order(created_at: :desc) }

  def preview(length = 100)
    content.to_plain_text.truncate(length)
  end
end
