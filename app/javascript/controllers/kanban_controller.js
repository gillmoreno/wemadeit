import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["column", "task"]

  connect() {
    this.setupDragAndDrop()
  }

  setupDragAndDrop() {
    this.taskTargets.forEach(task => {
      task.setAttribute("draggable", "true")
      task.addEventListener("dragstart", this.dragStart.bind(this))
      task.addEventListener("dragend", this.dragEnd.bind(this))
    })

    this.columnTargets.forEach(column => {
      column.addEventListener("dragover", this.dragOver.bind(this))
      column.addEventListener("dragenter", this.dragEnter.bind(this))
      column.addEventListener("dragleave", this.dragLeave.bind(this))
      column.addEventListener("drop", this.drop.bind(this))
    })
  }

  dragStart(event) {
    event.dataTransfer.setData("text/plain", event.target.dataset.taskId)
    event.dataTransfer.effectAllowed = "move"
    event.target.classList.add("opacity-50", "rotate-1", "shadow-lg")

    // Store the source column for position calculation
    this.sourceColumn = event.target.closest("[data-kanban-target='column']")
  }

  dragEnd(event) {
    event.target.classList.remove("opacity-50", "rotate-1", "shadow-lg")

    // Remove all drop indicators
    document.querySelectorAll(".drop-indicator").forEach(el => el.remove())
    this.columnTargets.forEach(col => {
      col.classList.remove("bg-blue-50", "ring-2", "ring-blue-300")
    })
  }

  dragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"

    // Show drop position indicator
    const column = event.target.closest("[data-kanban-target='column']")
    if (column) {
      this.updateDropIndicator(event, column)
    }
  }

  dragEnter(event) {
    event.preventDefault()
    const column = event.target.closest("[data-kanban-target='column']")
    if (column) {
      column.classList.add("bg-blue-50", "ring-2", "ring-blue-300")
    }
  }

  dragLeave(event) {
    const column = event.target.closest("[data-kanban-target='column']")
    if (column && !column.contains(event.relatedTarget)) {
      column.classList.remove("bg-blue-50", "ring-2", "ring-blue-300")
      column.querySelectorAll(".drop-indicator").forEach(el => el.remove())
    }
  }

  drop(event) {
    event.preventDefault()

    const column = event.target.closest("[data-kanban-target='column']")
    if (!column) return

    const taskId = event.dataTransfer.getData("text/plain")
    const columnId = column.dataset.columnId
    const task = document.querySelector(`[data-task-id="${taskId}"]`)

    if (task && columnId) {
      // Calculate position
      const position = this.calculateDropPosition(event, column)

      // Move the task card visually
      const tasksList = column.querySelector("[data-tasks-list]")
      if (tasksList) {
        const tasks = Array.from(tasksList.children).filter(el => el.dataset.taskId)
        if (position >= tasks.length) {
          tasksList.appendChild(task)
        } else {
          tasksList.insertBefore(task, tasks[position])
        }
      }

      // Update on server
      this.updateTaskPosition(taskId, columnId, position)
    }

    // Cleanup
    column.classList.remove("bg-blue-50", "ring-2", "ring-blue-300")
    document.querySelectorAll(".drop-indicator").forEach(el => el.remove())
  }

  updateDropIndicator(event, column) {
    // Remove existing indicators
    document.querySelectorAll(".drop-indicator").forEach(el => el.remove())

    const tasksList = column.querySelector("[data-tasks-list]")
    if (!tasksList) return

    const tasks = Array.from(tasksList.children).filter(el => el.dataset.taskId)
    const rect = tasksList.getBoundingClientRect()
    const y = event.clientY - rect.top

    let insertIndex = tasks.length
    for (let i = 0; i < tasks.length; i++) {
      const taskRect = tasks[i].getBoundingClientRect()
      const taskMiddle = taskRect.top - rect.top + taskRect.height / 2
      if (y < taskMiddle) {
        insertIndex = i
        break
      }
    }

    // Create indicator
    const indicator = document.createElement("div")
    indicator.className = "drop-indicator h-1 bg-blue-500 rounded my-1"

    if (insertIndex >= tasks.length) {
      tasksList.appendChild(indicator)
    } else {
      tasksList.insertBefore(indicator, tasks[insertIndex])
    }
  }

  calculateDropPosition(event, column) {
    const tasksList = column.querySelector("[data-tasks-list]")
    if (!tasksList) return 0

    const tasks = Array.from(tasksList.children).filter(el => el.dataset.taskId && !el.classList.contains("opacity-50"))
    const rect = tasksList.getBoundingClientRect()
    const y = event.clientY - rect.top

    for (let i = 0; i < tasks.length; i++) {
      const taskRect = tasks[i].getBoundingClientRect()
      const taskMiddle = taskRect.top - rect.top + taskRect.height / 2
      if (y < taskMiddle) {
        return i
      }
    }

    return tasks.length
  }

  async updateTaskPosition(taskId, columnId, position) {
    const csrfToken = document.querySelector("[name='csrf-token']").content

    try {
      const response = await fetch(`/tasks/${taskId}/move`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          column_id: columnId,
          position: position
        })
      })

      if (!response.ok) {
        throw new Error("Failed to update task position")
      }
    } catch (error) {
      console.error("Error moving task:", error)
      window.location.reload()
    }
  }
}
