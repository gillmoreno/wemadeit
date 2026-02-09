import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["canvas", "input", "typeInput", "typedSignature", "clearBtn", "tabDraw", "tabType"]
  static values = {
    mode: { type: String, default: "draw" }
  }

  connect() {
    this.setupCanvas()
    this.isDrawing = false
    this.lastX = 0
    this.lastY = 0
  }

  setupCanvas() {
    if (!this.hasCanvasTarget) return

    const canvas = this.canvasTarget
    this.ctx = canvas.getContext("2d")

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    // Configure drawing style
    this.ctx.strokeStyle = "#1E293B"
    this.ctx.lineWidth = 2
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"

    // Event listeners for drawing
    canvas.addEventListener("mousedown", this.startDrawing.bind(this))
    canvas.addEventListener("mousemove", this.draw.bind(this))
    canvas.addEventListener("mouseup", this.stopDrawing.bind(this))
    canvas.addEventListener("mouseout", this.stopDrawing.bind(this))

    // Touch support
    canvas.addEventListener("touchstart", this.handleTouchStart.bind(this))
    canvas.addEventListener("touchmove", this.handleTouchMove.bind(this))
    canvas.addEventListener("touchend", this.stopDrawing.bind(this))
  }

  startDrawing(event) {
    this.isDrawing = true
    const rect = this.canvasTarget.getBoundingClientRect()
    this.lastX = event.clientX - rect.left
    this.lastY = event.clientY - rect.top
  }

  draw(event) {
    if (!this.isDrawing) return

    const rect = this.canvasTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    this.ctx.beginPath()
    this.ctx.moveTo(this.lastX, this.lastY)
    this.ctx.lineTo(x, y)
    this.ctx.stroke()

    this.lastX = x
    this.lastY = y
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false
      this.saveSignature()
    }
  }

  handleTouchStart(event) {
    event.preventDefault()
    const touch = event.touches[0]
    const rect = this.canvasTarget.getBoundingClientRect()
    this.isDrawing = true
    this.lastX = touch.clientX - rect.left
    this.lastY = touch.clientY - rect.top
  }

  handleTouchMove(event) {
    event.preventDefault()
    if (!this.isDrawing) return

    const touch = event.touches[0]
    const rect = this.canvasTarget.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top

    this.ctx.beginPath()
    this.ctx.moveTo(this.lastX, this.lastY)
    this.ctx.lineTo(x, y)
    this.ctx.stroke()

    this.lastX = x
    this.lastY = y
  }

  clear() {
    if (this.hasCanvasTarget) {
      this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height)
      this.inputTarget.value = ""
    }
    if (this.hasTypeInputTarget) {
      this.typeInputTarget.value = ""
      this.updateTypedSignature()
    }
  }

  saveSignature() {
    if (this.modeValue === "draw" && this.hasCanvasTarget) {
      const dataUrl = this.canvasTarget.toDataURL("image/png")
      this.inputTarget.value = dataUrl
    }
  }

  switchToDrawMode(event) {
    event?.preventDefault()
    this.modeValue = "draw"
    this.updateTabs()

    if (this.hasCanvasTarget) {
      this.canvasTarget.parentElement.classList.remove("hidden")
    }
    if (this.hasTypedSignatureTarget) {
      this.typedSignatureTarget.parentElement.classList.add("hidden")
    }
  }

  switchToTypeMode(event) {
    event?.preventDefault()
    this.modeValue = "type"
    this.updateTabs()

    if (this.hasCanvasTarget) {
      this.canvasTarget.parentElement.classList.add("hidden")
    }
    if (this.hasTypedSignatureTarget) {
      this.typedSignatureTarget.parentElement.classList.remove("hidden")
    }
  }

  updateTabs() {
    if (this.hasTabDrawTarget && this.hasTabTypeTarget) {
      const activeClass = ["border-blue-500", "text-blue-600"]
      const inactiveClass = ["border-transparent", "text-gray-500"]

      if (this.modeValue === "draw") {
        this.tabDrawTarget.classList.add(...activeClass)
        this.tabDrawTarget.classList.remove(...inactiveClass)
        this.tabTypeTarget.classList.remove(...activeClass)
        this.tabTypeTarget.classList.add(...inactiveClass)
      } else {
        this.tabTypeTarget.classList.add(...activeClass)
        this.tabTypeTarget.classList.remove(...inactiveClass)
        this.tabDrawTarget.classList.remove(...activeClass)
        this.tabDrawTarget.classList.add(...inactiveClass)
      }
    }
  }

  updateTypedSignature() {
    if (this.hasTypeInputTarget && this.hasTypedSignatureTarget) {
      const name = this.typeInputTarget.value || ""
      this.typedSignatureTarget.textContent = name

      // Store the typed name in the input
      if (this.hasInputTarget && this.modeValue === "type") {
        this.inputTarget.value = `typed:${name}`
      }
    }
  }

  typeSignature(event) {
    this.updateTypedSignature()
  }
}
