import { TaxResponse } from '../types/index';

export async function calculateTax(
  taxServiceUrl: string,
  subtotalCents: number,
  state: string,
): Promise<TaxResponse> {
  const response = await fetch(`${taxServiceUrl}/tax`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subtotal_cents: subtotalCents, state }),
  });

  if (!response.ok) {
    throw new Error(`Tax service error: ${response.status}`);
  }

  return await response.json();
}
