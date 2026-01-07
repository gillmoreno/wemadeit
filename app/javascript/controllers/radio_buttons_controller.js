import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["label", "button"]

  connect() {
    // Apply initial state for any pre-selected radio
    this.labelTargets.forEach(label => {
      const radio = label.querySelector("input[type='radio']")
      if (radio && radio.checked) {
        this.highlightButton(label)
      }
    })
  }

  select(event) {
    // Remove highlight from all buttons
    this.buttonTargets.forEach(button => {
      button.classList.remove("border-blue-500", "bg-blue-50")
      button.classList.add("border-gray-200")
    })

    // Add highlight to selected button
    const label = event.target.closest("[data-radio-buttons-target='label']")
    if (label) {
      this.highlightButton(label)
    }
  }

  highlightButton(label) {
    const button = label.querySelector("[data-radio-buttons-target='button']")
    if (button) {
      button.classList.remove("border-gray-200")
      button.classList.add("border-blue-500", "bg-blue-50")
    }
  }
}
