const MIN_PROB = 0.001;
const MAX_PROB = 0.999;

export function clampProb(price: number): number {
  if (!Number.isFinite(price)) return MIN_PROB;
  return Math.min(MAX_PROB, Math.max(MIN_PROB, price));
}

export function priceToDecimal(price: number): number {
  return 1 / clampProb(price);
}

export function formatDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}
