import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["stage", "deal"]

  connect() {
    this.setupDragAndDrop()
  }

  setupDragAndDrop() {
    this.dealTargets.forEach(deal => {
      deal.setAttribute("draggable", "true")
      deal.addEventListener("dragstart", this.dragStart.bind(this))
      deal.addEventListener("dragend", this.dragEnd.bind(this))
    })

    this.stageTargets.forEach(stage => {
      stage.addEventListener("dragover", this.dragOver.bind(this))
      stage.addEventListener("dragenter", this.dragEnter.bind(this))
      stage.addEventListener("dragleave", this.dragLeave.bind(this))
      stage.addEventListener("drop", this.drop.bind(this))
    })
  }

  dragStart(event) {
    event.dataTransfer.setData("text/plain", event.target.dataset.dealId)
    event.target.classList.add("opacity-50", "rotate-2")
  }

  dragEnd(event) {
    event.target.classList.remove("opacity-50", "rotate-2")
  }

  dragOver(event) {
    event.preventDefault()
  }

  dragEnter(event) {
    event.preventDefault()
    const stage = event.target.closest("[data-pipeline-target='stage']")
    if (stage) {
      stage.classList.add("bg-blue-50", "ring-2", "ring-blue-300")
    }
  }

  dragLeave(event) {
    const stage = event.target.closest("[data-pipeline-target='stage']")
    if (stage && !stage.contains(event.relatedTarget)) {
      stage.classList.remove("bg-blue-50", "ring-2", "ring-blue-300")
    }
  }

  drop(event) {
    event.preventDefault()

    const stage = event.target.closest("[data-pipeline-target='stage']")
    if (!stage) return

    stage.classList.remove("bg-blue-50", "ring-2", "ring-blue-300")

    const dealId = event.dataTransfer.getData("text/plain")
    const stageId = stage.dataset.stageId
    const deal = document.querySelector(`[data-deal-id="${dealId}"]`)

    if (deal && stageId) {
      // Move the deal card visually
      const dealsList = stage.querySelector("[data-deals-list]")
      if (dealsList) {
        dealsList.appendChild(deal)
      }

      // Update on server
      this.updateDealStage(dealId, stageId)
    }
  }

  async updateDealStage(dealId, stageId) {
    const csrfToken = document.querySelector("[name='csrf-token']").content

    try {
      const response = await fetch(`/crm/deals/${dealId}/move`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({ stage_id: stageId })
      })

      if (!response.ok) {
        throw new Error("Failed to update deal stage")
      }
    } catch (error) {
      console.error("Error moving deal:", error)
      // Optionally reload the page to reset state
      window.location.reload()
    }
  }
}
