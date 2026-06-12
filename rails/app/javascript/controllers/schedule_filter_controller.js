import { Controller } from "@hotwired/stimulus"

// Client-side schedule filtering (全部 / 仅可预测 / 已结束). Toggles row
// visibility by match status, recomputes each day's count, hides empty days,
// and shows the empty-state message — mirroring the legacy ScheduleTimeline.
export default class extends Controller {
  static targets = ["tab", "section", "empty"]

  connect() {
    this.filter = "all"
  }

  select(event) {
    this.filter = event.currentTarget.dataset.filter
    this.tabTargets.forEach((tab) => tab.classList.toggle("on", tab === event.currentTarget))
    this.apply()
  }

  apply() {
    let anyVisible = false
    this.sectionTargets.forEach((section) => {
      let count = 0
      section.querySelectorAll("[data-status]").forEach((row) => {
        const show = this.matches(row.dataset.status)
        row.hidden = !show
        if (show) count += 1
      })
      const countEl = section.querySelector('[data-schedule-filter-target="count"]')
      if (countEl) countEl.textContent = count
      section.hidden = count === 0
      if (count > 0) anyVisible = true
    })
    if (this.hasEmptyTarget) this.emptyTarget.hidden = anyVisible
  }

  matches(status) {
    if (this.filter === "all") return true
    if (this.filter === "open") return status === "open"
    return status === "settled" || status === "locked" || status === "live"
  }
}
