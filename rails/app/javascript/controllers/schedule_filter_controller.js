import { Controller } from "@hotwired/stimulus"

// Client-side schedule filtering (比赛 / 已结束). "比赛" shows today's and
// future matches that aren't settled yet; "已结束" shows every settled match
// (any day, including today), newest day first. A tab is hidden when it has no
// matches, and the default tab falls back to "已结束" once every match is
// finished.
export default class extends Controller {
  static targets = ["tab", "section", "empty"]
  static values = { today: String }

  connect() {
    this.syncTabVisibility()
    this.filter = this.defaultFilter()
    this.apply()
  }

  select(event) {
    this.filter = event.currentTarget.dataset.filter
    this.apply()
  }

  // Hide a tab whose filter currently matches no rows; remember availability so
  // defaultFilter can pick a tab that actually has content.
  syncTabVisibility() {
    this.available = {}
    this.tabTargets.forEach((tab) => {
      const has = this.countFor(tab.dataset.filter) > 0
      this.available[tab.dataset.filter] = has
      tab.hidden = !has
    })
  }

  defaultFilter() {
    if (this.available["matches"]) return "matches"
    if (this.available["done"]) return "done"
    return "matches"
  }

  countFor(filter) {
    let count = 0
    this.sectionTargets.forEach((section) => {
      section.querySelectorAll("[data-status]").forEach((row) => {
        if (this.shouldShow(row.dataset.status, section.dataset.dayKey, filter)) count += 1
      })
    })
    return count
  }

  apply() {
    this.element.classList.toggle("schedule-done", this.filter === "done")
    this.tabTargets.forEach((tab) => tab.classList.toggle("on", tab.dataset.filter === this.filter))

    let anyVisible = false
    this.sectionTargets.forEach((section) => {
      const dayKey = section.dataset.dayKey
      let count = 0
      section.querySelectorAll("[data-status]").forEach((row) => {
        const show = this.shouldShow(row.dataset.status, dayKey, this.filter)
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

  shouldShow(status, dayKey, filter) {
    if (filter === "done") return status === "settled"
    return dayKey >= this.todayValue && status !== "settled"
  }
}
