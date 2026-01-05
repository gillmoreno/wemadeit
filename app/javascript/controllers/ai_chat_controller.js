import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["output", "input", "loading", "button"]
  static values = {
    endpoint: String,
    notableType: String,
    notableId: String
  }

  connect() {
    this.hideLoading()
  }

  async summarizeNotes(event) {
    event.preventDefault()

    if (!this.notableTypeValue || !this.notableIdValue) {
      this.showError("Missing context for summarization")
      return
    }

    this.showLoading()

    try {
      const response = await fetch("/ai/summarize_notes", {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          notable_type: this.notableTypeValue,
          notable_id: this.notableIdValue
        })
      })

      const data = await response.json()

      if (response.ok) {
        this.showResult(data.summary)
      } else {
        this.showError(data.error || "Failed to summarize notes")
      }
    } catch (error) {
      this.showError("Request failed. Please try again.")
    } finally {
      this.hideLoading()
    }
  }

  async draftEmail(event) {
    event.preventDefault()

    const interactionId = event.currentTarget.dataset.interactionId
    if (!interactionId) {
      this.showError("No interaction selected")
      return
    }

    this.showLoading()

    try {
      const response = await fetch("/ai/draft_email", {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ interaction_id: interactionId })
      })

      const data = await response.json()

      if (response.ok) {
        this.showResult(data.draft)
      } else {
        this.showError(data.error || "Failed to draft email")
      }
    } catch (error) {
      this.showError("Request failed. Please try again.")
    } finally {
      this.hideLoading()
    }
  }

  async analyzeScope(event) {
    event.preventDefault()

    const content = this.hasInputTarget ? this.inputTarget.value : ""
    if (!content.trim()) {
      this.showError("Please enter requirements to analyze")
      return
    }

    this.showLoading()

    try {
      const response = await fetch("/ai/analyze_scope", {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ content: content })
      })

      const data = await response.json()

      if (response.ok) {
        this.showResult(data.analysis)
      } else {
        this.showError(data.error || "Failed to analyze scope")
      }
    } catch (error) {
      this.showError("Request failed. Please try again.")
    } finally {
      this.hideLoading()
    }
  }

  showLoading() {
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.remove("hidden")
    }
    if (this.hasButtonTarget) {
      this.buttonTarget.disabled = true
    }
  }

  hideLoading() {
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.add("hidden")
    }
    if (this.hasButtonTarget) {
      this.buttonTarget.disabled = false
    }
  }

  showResult(content) {
    if (this.hasOutputTarget) {
      this.outputTarget.innerHTML = this.formatContent(content)
      this.outputTarget.classList.remove("hidden", "text-red-600")
      this.outputTarget.classList.add("text-gray-700")
    }
  }

  showError(message) {
    if (this.hasOutputTarget) {
      this.outputTarget.textContent = message
      this.outputTarget.classList.remove("hidden", "text-gray-700")
      this.outputTarget.classList.add("text-red-600")
    }
  }

  formatContent(content) {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n\n/g, "</p><p class='mt-2'>")
      .replace(/\n- /g, "<br>• ")
      .replace(/\n(\d+)\. /g, "<br>$1. ")
  }

  get headers() {
    return {
      "Content-Type": "application/json",
      "X-CSRF-Token": document.querySelector("[name='csrf-token']").content
    }
  }
}
