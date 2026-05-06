import axios from 'axios';

export interface TaxResponse {
  tax_cents: number;
}

export async function calculateTax(
  baseUrl: string,
  subtotalCents: number,
  state: string
): Promise<TaxResponse> {
  const response = await axios.post(`${baseUrl}/tax`, {
    subtotal_cents: subtotalCents,
    state,
  }, {
    timeout: 2000,
  });
  return response.data;
}
