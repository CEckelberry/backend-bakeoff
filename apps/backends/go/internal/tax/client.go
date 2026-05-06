package tax

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type TaxRequest struct {
	SubtotalCents int    `json:"subtotal_cents"`
	State         string `json:"state"`
}

type TaxResponse struct {
	TaxCents int `json:"tax_cents"`
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

func (c *Client) CalculateTax(ctx context.Context, req TaxRequest) (*TaxResponse, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/tax", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("tax service unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tax service returned status %d", resp.StatusCode)
	}

	var taxResp TaxResponse
	if err := json.NewDecoder(resp.Body).Decode(&taxResp); err != nil {
		return nil, err
	}
	return &taxResp, nil
}
