package domain

func ComputeFraudScore(totalCents int, itemCount int) int {
	return (totalCents / 100) + (itemCount * 10)
}
