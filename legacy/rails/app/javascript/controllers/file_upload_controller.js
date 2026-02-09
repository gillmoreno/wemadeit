import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["dropzone", "droparea", "input", "fileInfo", "fileName"]

  connect() {
    // Make the droparea clickable to open file dialog
    this.dropareaTarget.addEventListener("click", () => {
      this.inputTarget.click()
    })
  }

  dragover(event) {
    event.preventDefault()
    event.stopPropagation()
  }

  dragenter(event) {
    event.preventDefault()
    event.stopPropagation()
    this.dropareaTarget.classList.add("border-blue-400", "bg-blue-50")
    this.dropareaTarget.classList.remove("border-gray-300", "bg-gray-50")
  }

  dragleave(event) {
    event.preventDefault()
    event.stopPropagation()
    this.dropareaTarget.classList.remove("border-blue-400", "bg-blue-50")
    this.dropareaTarget.classList.add("border-gray-300", "bg-gray-50")
  }

  drop(event) {
    event.preventDefault()
    event.stopPropagation()

    this.dropareaTarget.classList.remove("border-blue-400", "bg-blue-50")
    this.dropareaTarget.classList.add("border-gray-300", "bg-gray-50")

    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]

      // Validate file type
      if (!file.type.startsWith("audio/")) {
        alert("Please upload an audio file (MP3, WAV, M4A, or WebM)")
        return
      }

      // Validate file size (100MB)
      if (file.size > 100 * 1024 * 1024) {
        alert("File size must be less than 100MB")
        return
      }

      // Set the file to the input
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      this.inputTarget.files = dataTransfer.files

      this.showFileInfo(file.name)
    }
  }

  fileSelected(event) {
    const file = event.target.files[0]
    if (file) {
      this.showFileInfo(file.name)
    }
  }

  showFileInfo(fileName) {
    this.fileInfoTarget.classList.remove("hidden")
    this.fileNameTarget.textContent = fileName
    this.dropareaTarget.classList.add("hidden")
  }

  removeFile() {
    this.inputTarget.value = ""
    this.fileInfoTarget.classList.add("hidden")
    this.dropareaTarget.classList.remove("hidden")
  }
}
