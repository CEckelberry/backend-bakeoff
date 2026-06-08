import type { RequestHandler } from './$types';

const RESULTS_API_URL = process.env.RESULTS_API_URL || 'http://results-api:8080';

export const GET: RequestHandler = async () => {
	try {
		const res = await fetch(`${RESULTS_API_URL}/results`);
		const data = await res.text();
		return new Response(data, {
			status: res.status,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=30'
			}
		});
	} catch {
		return new Response(JSON.stringify({ error: 'results-api unreachable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.text();
		const res = await fetch(`${RESULTS_API_URL}/results`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		});
		const data = await res.text();
		return new Response(data, {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({ error: 'results-api unreachable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
