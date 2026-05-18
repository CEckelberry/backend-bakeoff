# API Contract

The source of truth for all backend implementations is the OpenAPI specification located at `api/openapi.yaml`.

## How to use this spec

### Generating Server Stubs
To ensure 100% compliance, it is recommended to generate types and server stubs using:
- **Go**: `oapi-codegen`
- **Rust**: `openapi-generator` or `utoipa`
- **Node**: `openapi-typescript`
- **Python**: `openapi-python-client` or `openapi-spec-validator`
- **PHP**: `openapi-generator` with PHP template

### Validation
Run the following command to lint the specification:

```bash
make contract
```

This will run `redocly lint` on the OpenAPI specification and report any errors.

### Documentation
You can view the interactive documentation by importing `api/openapi.yaml` into:
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [ReDoc](https://redoc.ly/)
- [Postman](https://www.postman.com/)

## API Endpoints

### POST /checkout
Creates a new order from a shopping cart.

**Request:**
```json
{
  "customer_id": "uuid",
  "shipping_address": {
    "country": "US",
    "postal_code": "90210"
  },
  "cart": [
    {
      "product_id": "uuid",
      "quantity": 2
    }
  ]
}
```

**Response (201):**
```json
{
  "order_id": "uuid",
  "total_cents": 10000,
  "tax_cents": 800,
  "items": [
    {
      "product_id": "uuid",
      "product_name": "Widget",
      "quantity": 2,
      "price_cents": 5000
    }
  ],
  "created_at": "2025-01-01T12:00:00Z"
}
```

**Error Cases:**
- `400 Bad Request`: Cart too large (>8 items) or malformed JSON
- `422 Unprocessable Entity`: Empty cart, unknown product, out of stock
- `500 Internal Server Error`: Database error or system failure

### GET /health
Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "runtime": "go"
}
```

**Response (503 when degraded):**
```json
{
  "status": "degraded",
  "runtime": "go"
}
```

## Contract Conformance

All backend implementations **must** satisfy these constraints:

1. **Request Validation:**
   - Cart must have 1-8 items (inclusive)
   - All product IDs must be valid UUIDs
   - Customer ID must be a valid UUID
   - Country must be 2-character ISO code

2. **Response Format:**
   - All responses must match the schema exactly
   - `order_id`, `customer_id`, `product_id` must be UUIDs
   - All timestamps must be ISO 8601 format
   - All monetary values must be in cents (integers)

3. **Status Codes:**
   - `201`: Order created successfully
   - `400`: Validation failed (bad request)
   - `422`: Validation failed (unprocessable entity)
   - `500`: Server error
   - `200`: Health check OK
   - `503`: Health check degraded/unavailable

4. **Performance:**
   - `/checkout` response time must be < 1s (p99)
   - `/health` response time must be < 100ms
