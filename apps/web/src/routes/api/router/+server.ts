import type { RequestHandler } from './$types';

const ROUTER_URL = process.env.ROUTER_URL || 'http://router:8080';

export const POST: RequestHandler = async ({ request }) => {
	const runtime = request.headers.get('X-Runtime') || 'go';
	try {
		const body = await request.text();
		const res = await fetch(`${ROUTER_URL}/checkout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Runtime': runtime
			},
			body
		});
		const data = await res.text();
		return new Response(data, {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({ error: 'router unreachable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
