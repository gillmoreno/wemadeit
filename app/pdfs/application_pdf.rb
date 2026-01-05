class ApplicationPdf < Prawn::Document
  include ActionView::Helpers::NumberHelper

  DEFAULT_OPTIONS = {
    page_size: "A4",
    margin: [40, 50, 40, 50]
  }.freeze

  COLORS = {
    primary: "2563EB",
    secondary: "64748B",
    success: "10B981",
    warning: "F59E0B",
    danger: "EF4444",
    dark: "1E293B",
    light: "F1F5F9",
    muted: "94A3B8"
  }.freeze

  def initialize(options = {})
    super(DEFAULT_OPTIONS.merge(options))
    setup_fonts
  end

  private

  def setup_fonts
    font_families.update(
      "Helvetica" => {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italic: "Helvetica-Oblique",
        bold_italic: "Helvetica-BoldOblique"
      }
    )
    font "Helvetica"
  end

  def primary_color
    COLORS[:primary]
  end

  def secondary_color
    COLORS[:secondary]
  end

  def header_text(text, options = {})
    text text, {
      size: 24,
      style: :bold,
      color: COLORS[:dark]
    }.merge(options)
  end

  def subheader_text(text, options = {})
    text text, {
      size: 14,
      style: :bold,
      color: COLORS[:secondary]
    }.merge(options)
  end

  def body_text(text, options = {})
    text text, {
      size: 10,
      color: COLORS[:dark]
    }.merge(options)
  end

  def muted_text(text, options = {})
    text text, {
      size: 9,
      color: COLORS[:muted]
    }.merge(options)
  end

  def horizontal_rule
    stroke_color COLORS[:light]
    stroke_horizontal_rule
    move_down 10
  end

  def format_currency(amount, currency = "EUR")
    number_to_currency(amount || 0, unit: "#{currency} ", precision: 2)
  end

  def format_date(date)
    return "N/A" unless date
    date.strftime("%d %B %Y")
  end
end
