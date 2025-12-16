(() => {
	const iframe = document.querySelector('.stackblitz-embed[data-src]');
	if (!iframe) return;

	const loadEmbed = () => {
		if (iframe.dataset.src) {
			iframe.src = iframe.dataset.src;
			iframe.removeAttribute('data-src');
		}
	};

	if ('IntersectionObserver' in window) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					loadEmbed();
					observer.disconnect();
				}
			},
			{ rootMargin: '256px 0px' },
		);
		observer.observe(iframe);
	} else {
		loadEmbed();
	}
})();
