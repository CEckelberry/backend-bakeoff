import { init, track as amplitudeTrack } from '@amplitude/analytics-browser';
import { PUBLIC_AMPLITUDE_API_KEY } from '$env/dynamic/public';

let initialized = false;

export function initAmplitude(): void {
	if (initialized || !PUBLIC_AMPLITUDE_API_KEY) return;
	init(PUBLIC_AMPLITUDE_API_KEY, undefined, {
		defaultTracking: {
			pageViews: true,
			sessions: true,
			formInteractions: false,
			fileDownloads: false,
		},
	});
	initialized = true;
}

export function track(eventName: string, properties?: Record<string, unknown>): void {
	if (!initialized) return;
	amplitudeTrack(eventName, properties);
}
