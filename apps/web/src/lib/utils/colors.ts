import type { Runtime } from '$lib/config';

const runtimeColors: Record<string, string> = {
	go: '#5DCAA5',
	rust: '#FAC775',
	bun: '#F4C0D1',
	node: '#AFA9EC',
	python: '#ED93B1',
	php: '#7F77DD'
};

export const getRuntimeColor = (runtimeId: string): string => {
	return runtimeColors[runtimeId] || '#64748b';
};

export const getRuntimeColorWithOpacity = (runtimeId: string, opacity: number): string => {
	const color = getRuntimeColor(runtimeId);
	const hex = color.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};