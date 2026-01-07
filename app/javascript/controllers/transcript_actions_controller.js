import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { interactionId: Number }

  async transcribe(event) {
    const button = event.currentTarget
    const originalText = button.innerHTML

    button.disabled = true
    button.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Transcribing...
    `

    try {
      const response = await fetch("/ai/transcribe_audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        },
        body: JSON.stringify({ interaction_id: this.interactionIdValue })
      })

      const data = await response.json()

      if (response.ok) {
        window.location.reload()
      } else {
        alert(`Error: ${data.error}`)
        button.disabled = false
        button.innerHTML = originalText
      }
    } catch (error) {
      alert(`Error: ${error.message}`)
      button.disabled = false
      button.innerHTML = originalText
    }
  }

  async clean(event) {
    const button = event.currentTarget
    const originalText = button.innerHTML

    button.disabled = true
    button.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Cleaning...
    `

    try {
      const response = await fetch("/ai/clean_transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        },
        body: JSON.stringify({ interaction_id: this.interactionIdValue })
      })

      const data = await response.json()

      if (response.ok) {
        window.location.reload()
      } else {
        alert(`Error: ${data.error}`)
        button.disabled = false
        button.innerHTML = originalText
      }
    } catch (error) {
      alert(`Error: ${error.message}`)
      button.disabled = false
      button.innerHTML = originalText
    }
  }
}
