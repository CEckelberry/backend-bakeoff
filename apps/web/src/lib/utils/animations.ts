export const easeOutQuart = (t: number): number => {
	return 1 - Math.pow(1 - t, 4);
};

export const easeSpring = (t: number): number => {
	const c4 = (2 * Math.PI) / 3;
	return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

export const animateValue = (
	start: number,
	end: number,
	duration: number,
	easing: (t: number) => number = easeOutQuart
): Promise<number> => {
	return new Promise((resolve) => {
		const startTime = performance.now();
		
		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = easing(progress);
			const currentValue = start + (end - start) * easedProgress;
			
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				resolve(currentValue);
			}
		};
		
		requestAnimationFrame(animate);
	});
};