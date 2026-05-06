export function computeFraudScore(totalCents: number, itemCount: number): number {
  return Math.floor(totalCents / 100) + itemCount * 10;
}
