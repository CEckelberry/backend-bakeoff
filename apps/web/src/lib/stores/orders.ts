import { writable } from 'svelte/store';

export interface Order {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  time: string;
}

export const orders = writable<Order[]>([]);

export function addOrder(order: Order) {
  orders.update(list => {
    list.unshift(order);
    if (list.length > 20) list.pop();
    return list;
  });
}
