import type { RequestHandler } from './$types';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';

export const GET: RequestHandler = async ({ params, url }) => {
	const upstream = `${PROMETHEUS_URL}/api/v1/${params.path}?${url.searchParams.toString()}`;
	try {
		const res = await fetch(upstream);
		const data = await res.text();
		return new Response(data, {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({ status: 'error', error: 'prometheus unreachable' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
