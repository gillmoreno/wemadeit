import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["template", "container", "item"]

  add(event) {
    event.preventDefault()

    const content = this.templateTarget.innerHTML.replace(/NEW_RECORD/g, new Date().getTime())
    this.containerTarget.insertAdjacentHTML("beforeend", content)

    // Trigger event for other controllers
    this.dispatch("added")
  }

  remove(event) {
    event.preventDefault()

    const item = event.target.closest("[data-nested-form-target='item']")
    if (!item) return

    // Check if this is a persisted record (has an ID)
    const destroyInput = item.querySelector("input[name*='_destroy']")

    if (destroyInput) {
      // Mark for destruction and hide
      destroyInput.value = "1"
      item.classList.add("hidden")
    } else {
      // New record, just remove from DOM
      item.remove()
    }

    // Trigger event for other controllers
    this.dispatch("removed")
  }

  updatePositions() {
    this.itemTargets.forEach((item, index) => {
      const positionInput = item.querySelector("input[name*='position']")
      if (positionInput) {
        positionInput.value = index
      }
    })
  }
}
