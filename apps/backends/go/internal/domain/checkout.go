package domain

import (
	"context"
	"fmt"

	"backend-bakeoff-go/internal/store"
	"backend-bakeoff-go/internal/tax"
	"github.com/google/uuid"
)

type CheckoutRequest struct {
	CustomerID string `json:"customer_id"`
	Items      []struct {
		ProductID string `json:"product_id"`
		Quantity  int    `json:"quantity"`
	} `json:"items"`
	State string `json:"state"`
}

type CheckoutResponse struct {
	OrderID    string `json:"order_id"`
	TotalCents int    `json:"total_cents"`
	TaxCents   int    `json:"tax_cents"`
	FraudScore int    `json:"fraud_score"`
}

func ProcessCheckout(ctx context.Context, req CheckoutRequest, s *store.PostgresStore, t *tax.Client) (*CheckoutResponse, error) {
	if len(req.Items) == 0 || len(req.Items) > 8 {
		return nil, fmt.Errorf("cart must have between 1 and 8 items")
	}

	custID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("invalid customer id")
	}

	var subtotal int
	var orderItems []store.OrderItem

	for _, itemReq := range req.Items {
		pID, err := uuid.Parse(itemReq.ProductID)
		if err != nil {
			return nil, fmt.Errorf("invalid product id: %s", itemReq.ProductID)
		}

		prod, err := s.GetProduct(ctx, pID)
		if err != nil {
			return nil, fmt.Errorf("product not found: %s", itemReq.ProductID)
		}

		if prod.Stock < itemReq.Quantity {
			return nil, fmt.Errorf("insufficient stock for product %s", itemReq.ProductID)
		}

		subtotal += prod.Price * itemReq.Quantity
		orderItems = append(orderItems, store.OrderItem{
			ProductID: pID,
			Quantity:  itemReq.Quantity,
			Price:     prod.Price,
		})
	}

	taxRes, err := t.CalculateTax(ctx, tax.TaxRequest{
		SubtotalCents: subtotal,
		State:         req.State,
	})
	if err != nil {
		return nil, err
	}

	fraudScore := ComputeFraudScore(subtotal, len(req.Items))
	orderID := uuid.New()
	total := subtotal + taxRes.TaxCents

	err = s.InsertOrder(ctx, store.Order{
		ID:         orderID,
		CustomerID: custID,
		TotalCents: total,
		TaxCents:   taxRes.TaxCents,
	}, orderItems)
	if err != nil {
		return nil, err
	}

	return &CheckoutResponse{
		OrderID:    orderID.String(),
		TotalCents: total,
		TaxCents:   taxRes.TaxCents,
		FraudScore: fraudScore,
	}, nil
}
