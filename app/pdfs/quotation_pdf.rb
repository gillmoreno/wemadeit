class QuotationPdf < ApplicationPdf
  def initialize(quotation)
    super()
    @quotation = quotation
    @organization = quotation.organization
    @contact = quotation.contact
    @items = quotation.quotation_items.includes(:service).order(:position)

    generate
  end

  private

  def generate
    header
    move_down 30
    client_info
    move_down 20
    quote_details
    move_down 30
    items_table
    move_down 20
    totals
    move_down 30
    terms if @quotation.terms.present?
    signature if @quotation.signature.present?
    footer
  end

  def header
    # Company name
    text "wemadeit", size: 28, style: :bold, color: primary_color

    move_down 5
    muted_text "Software Development Studio"

    # Quote number and date on right side
    move_up 35
    text_box "Quotation #{@quotation.number}", at: [bounds.width - 200, cursor], width: 200, align: :right, size: 14, style: :bold
    text_box format_date(@quotation.created_at), at: [bounds.width - 200, cursor - 20], width: 200, align: :right, size: 10, color: COLORS[:muted]

    move_down 30
    horizontal_rule
  end

  def client_info
    subheader_text "Prepared for:"
    move_down 5

    body_text @organization.name, style: :bold
    body_text @contact.name if @contact
    body_text @contact.job_title if @contact&.job_title
    body_text @organization.address if @organization.address
    body_text "#{@organization.city}, #{@organization.country}".strip.gsub(/^,\s*|,\s*$/, "") if @organization.city || @organization.country
    body_text @organization.email if @organization.email
  end

  def quote_details
    data = [
      ["Subject:", @quotation.subject],
      ["Valid Until:", format_date(@quotation.valid_until)],
      ["Status:", @quotation.status.humanize]
    ]

    table(data, cell_style: { borders: [], padding: [2, 10, 2, 0] }) do
      column(0).font_style = :bold
      column(0).width = 80
    end

    if @quotation.introduction.present?
      move_down 15
      body_text @quotation.introduction
    end
  end

  def items_table
    subheader_text "Services & Items"
    move_down 10

    header_row = ["Description", "Qty", "Unit Price", "Total"]

    item_rows = @items.map do |item|
      description = item.description.presence || item.service&.name || "Service"
      [
        description,
        item.quantity.to_s,
        format_currency(item.unit_price, @quotation.currency),
        format_currency(item.line_total, @quotation.currency)
      ]
    end

    table([header_row] + item_rows, header: true, width: bounds.width) do
      row(0).font_style = :bold
      row(0).background_color = COLORS[:light]

      cells.borders = [:bottom]
      cells.border_color = COLORS[:light]
      cells.padding = [8, 5, 8, 5]

      column(0).width = bounds.width * 0.5
      column(1).width = bounds.width * 0.1
      column(1).align = :center
      column(2).width = bounds.width * 0.2
      column(2).align = :right
      column(3).width = bounds.width * 0.2
      column(3).align = :right
    end
  end

  def totals
    subtotal = @quotation.subtotal
    tax = @quotation.tax_amount
    discount = @quotation.total_discount
    total = @quotation.total

    totals_data = [
      ["Subtotal:", format_currency(subtotal, @quotation.currency)]
    ]

    if discount > 0
      totals_data << ["Discount:", "-#{format_currency(discount, @quotation.currency)}"]
    end

    if @quotation.tax_rate && @quotation.tax_rate > 0
      totals_data << ["VAT (#{@quotation.tax_rate}%):", format_currency(tax, @quotation.currency)]
    end

    totals_data << ["Total:", format_currency(total, @quotation.currency)]

    bounding_box([bounds.width - 200, cursor], width: 200) do
      table(totals_data, cell_style: { borders: [], padding: [4, 0] }) do
        column(0).width = 100
        column(0).align = :right
        column(1).width = 100
        column(1).align = :right

        row(-1).font_style = :bold
        row(-1).size = 12
      end
    end
  end

  def terms
    move_down 20
    subheader_text "Terms & Conditions"
    move_down 5
    body_text @quotation.terms, size: 9, color: COLORS[:secondary]
  end

  def signature
    move_down 30
    horizontal_rule
    move_down 10

    subheader_text "Accepted"
    move_down 10

    sig = @quotation.signature

    if sig.signature_type == "drawn" && sig.signature_data.present?
      # Decode and render signature image
      begin
        image_data = sig.signature_data.sub(/^data:image\/\w+;base64,/, "")
        image StringIO.new(Base64.decode64(image_data)), width: 150
      rescue StandardError
        body_text "[Signature on file]"
      end
    else
      body_text sig.signer_name, style: :italic, size: 16
    end

    move_down 5
    muted_text "#{sig.signer_name} - #{sig.signer_email}"
    muted_text "Signed on #{format_date(sig.signed_at)}"
  end

  def footer
    repeat :all do
      bounding_box([0, 20], width: bounds.width, height: 20) do
        muted_text "Generated on #{format_date(Time.current)} | wemadeit", align: :center, size: 8
      end
    end
  end
end
