import { ALL_RUNTIMES } from '$lib/config';

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randIntBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(randBetween(rng, min, max));
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateCart(seed: number = Date.now()): {
  id: string;
  items: Array<{ name: string; price: number; quantity: number }>;
  total: number;
} {
  const rng = createRng(seed);

  const products = [
    { name: 'Wireless Mouse', price: 29.99 },
    { name: 'USB-C Hub', price: 49.99 },
    { name: 'Mechanical Keyboard', price: 129.99 },
    { name: 'Monitor Stand', price: 39.99 },
    { name: 'Desk Lamp', price: 44.99 },
    { name: 'Webcam HD', price: 79.99 },
    { name: 'Headphone Stand', price: 14.99 },
    { name: 'Cable Organizer', price: 9.99 },
  ];

  const itemCount = randIntBetween(rng, 1, 5);
  const items = Array.from({ length: itemCount }, () => ({
    name: pick(rng, products).name,
    price: pick(rng, products).price,
    quantity: randIntBetween(rng, 1, 3),
  }));

  const total = parseFloat(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );

  return {
    id: `cart-${randIntBetween(rng, 100000, 999999)}`,
    items,
    total,
  };
}
