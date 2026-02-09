import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["subtotal", "discount", "tax", "total", "item", "taxRate"]

  connect() {
    this.calculate()
  }

  calculate() {
    let subtotal = 0

    this.itemTargets.forEach(item => {
      if (item.classList.contains("hidden")) return

      const qty = parseFloat(item.querySelector("[data-field='quantity']")?.value) || 0
      const price = parseFloat(item.querySelector("[data-field='unit_price']")?.value) || 0
      const lineTotal = qty * price

      // Update line total display
      const lineTotalEl = item.querySelector("[data-field='line_total']")
      if (lineTotalEl) {
        lineTotalEl.textContent = this.formatCurrency(lineTotal)
      }

      subtotal += lineTotal
    })

    // Get discount
    const discountAmount = parseFloat(this.element.querySelector("[data-field='discount_amount']")?.value) || 0
    const discountPercent = parseFloat(this.element.querySelector("[data-field='discount_percentage']")?.value) || 0
    const discountFromPercent = subtotal * (discountPercent / 100)
    const totalDiscount = discountAmount + discountFromPercent

    // Get tax rate
    const taxRate = parseFloat(this.element.querySelector("[data-field='tax_rate']")?.value) || 0
    const taxableAmount = subtotal - totalDiscount
    const taxAmount = taxableAmount * (taxRate / 100)

    // Calculate total
    const total = taxableAmount + taxAmount

    // Update displays
    if (this.hasSubtotalTarget) {
      this.subtotalTarget.textContent = this.formatCurrency(subtotal)
    }
    if (this.hasDiscountTarget) {
      this.discountTarget.textContent = this.formatCurrency(totalDiscount)
    }
    if (this.hasTaxTarget) {
      this.taxTarget.textContent = this.formatCurrency(taxAmount)
    }
    if (this.hasTotalTarget) {
      this.totalTarget.textContent = this.formatCurrency(total)
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat("en-EU", {
      style: "currency",
      currency: "EUR"
    }).format(amount)
  }

  serviceSelected(event) {
    const select = event.target
    const item = select.closest("[data-quote-builder-target='item']")
    if (!item) return

    const option = select.selectedOptions[0]
    const price = option?.dataset.price

    if (price) {
      const priceInput = item.querySelector("[data-field='unit_price']")
      if (priceInput) {
        priceInput.value = price
        this.calculate()
      }
    }
  }

  itemAdded() {
    this.calculate()
  }

  itemRemoved() {
    this.calculate()
  }
}
