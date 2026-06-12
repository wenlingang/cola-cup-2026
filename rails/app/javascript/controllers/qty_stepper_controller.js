import { Controller } from "@hotwired/stimulus"

// Per-drink quantity stepper. The ± buttons clamp at 1, and the hidden qty
// field and the submit label ("兑换 · X") stay in sync. Redeeming is never
// blocked by balance — anyone can redeem and the balance may go negative.
export default class extends Controller {
  static targets = ["qty", "qtyInput", "submit", "dec"]
  static values = {
    cost: Number,
    qty: { type: Number, default: 1 },
  }

  connect() {
    this.render()
  }

  inc() {
    this.qtyValue = this.qtyValue + 1
  }

  dec() {
    this.qtyValue = Math.max(1, this.qtyValue - 1)
  }

  qtyValueChanged() {
    this.render()
  }

  render() {
    const qty = Math.max(1, this.qtyValue)
    const total = this.costValue * qty
    this.qtyTarget.textContent = qty
    this.qtyInputTarget.value = qty
    this.submitTarget.textContent = `兑换 · ${this.format(total)}`
    if (this.hasDecTarget) this.decTarget.disabled = qty <= 1
  }

  format(value) {
    return value % 1 === 0 ? String(value) : value.toFixed(1)
  }
}
