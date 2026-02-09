import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "button",
    "status",
    "transcript",
    "name",
    "industry",
    "website",
    "email",
    "phone",
    "address",
    "city",
    "country",
    "notes"
  ]

  connect() {
    this.mediaRecorder = null
    this.chunks = []
    this.recording = false
  }

  async toggle() {
    if (this.recording) {
      this.stopRecording()
    } else {
      await this.startRecording()
    }
  }

  async startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setStatus("Your browser does not support audio recording.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.chunks = []
      this.mediaRecorder = new MediaRecorder(stream)

      this.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data)
        }
      })

      this.mediaRecorder.addEventListener("stop", () => {
        stream.getTracks().forEach((track) => track.stop())
        this.handleRecordingStop()
      })

      this.mediaRecorder.start()
      this.recording = true
      this.setButtonState("Stop recording")
      this.setStatus("Recording... click again to stop.")
    } catch (error) {
      this.setStatus(`Microphone error: ${error.message}`)
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.recording) {
      this.mediaRecorder.stop()
      this.recording = false
      this.setButtonState("Processing...")
      this.setStatus("Transcribing and extracting fields...")
    }
  }

  async handleRecordingStop() {
    const blob = new Blob(this.chunks, { type: "audio/webm" })
    const formData = new FormData()
    formData.append("audio", blob, "organization.webm")

    try {
      const response = await fetch("/ai/suggest_organization", {
        method: "POST",
        headers: {
          "X-CSRF-Token": document.querySelector("meta[name='csrf-token']").content
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Unable to process audio.")
      }

      this.applySuggestions(data.fields || {})
      this.showTranscript(data.transcript)
      this.setStatus("Suggestions applied. Please review and edit before saving.")
      this.setButtonState("Start voice fill")
    } catch (error) {
      this.setStatus(`Error: ${error.message}`)
      this.setButtonState("Start voice fill")
    }
  }

  applySuggestions(fields) {
    const mapping = {
      name: this.hasNameTarget ? this.nameTarget : null,
      industry: this.hasIndustryTarget ? this.industryTarget : null,
      website: this.hasWebsiteTarget ? this.websiteTarget : null,
      email: this.hasEmailTarget ? this.emailTarget : null,
      phone: this.hasPhoneTarget ? this.phoneTarget : null,
      address: this.hasAddressTarget ? this.addressTarget : null,
      city: this.hasCityTarget ? this.cityTarget : null,
      country: this.hasCountryTarget ? this.countryTarget : null,
      notes: this.hasNotesTarget ? this.notesTarget : null
    }

    Object.entries(fields).forEach(([key, value]) => {
      if (!value) return
      const target = mapping[key]
      if (!target) return
      if (target.value && target.value.trim().length > 0) return
      target.value = value
      target.classList.add("ring-1", "ring-blue-300")
    })
  }

  showTranscript(transcript) {
    if (!this.hasTranscriptTarget || !transcript) return
    this.transcriptTarget.textContent = transcript
    this.transcriptTarget.classList.remove("hidden")
  }

  setStatus(message) {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = message
    }
  }

  setButtonState(label) {
    if (this.hasButtonTarget) {
      this.buttonTarget.textContent = label
    }
  }
}
