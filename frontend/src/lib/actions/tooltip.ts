export function tooltip(node: HTMLElement, text: string) {
	let tooltipElement: HTMLDivElement | null = null;
	let timeout: ReturnType<typeof setTimeout> | null = null;

	function positionTooltip() {
		if (!tooltipElement) return;

		const rect = node.getBoundingClientRect();
		const tooltipRect = tooltipElement.getBoundingClientRect();

		let top = rect.top - tooltipRect.height - 10;
		let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

		// Flip to bottom if it goes off top
		if (top < 10) {
			top = rect.bottom + 10;
		}

		// Keep within viewport horizontally
		if (left < 10) left = 10;
		if (left + tooltipRect.width > window.innerWidth - 10) {
			left = window.innerWidth - tooltipRect.width - 10;
		}

		tooltipElement.style.top = `${top + window.scrollY}px`;
		tooltipElement.style.left = `${left + window.scrollX}px`;
	}

	function show() {
		timeout = setTimeout(() => {
			tooltipElement = document.createElement('div');
			tooltipElement.textContent = text;
			tooltipElement.className = 'custom-tooltip';
			document.body.appendChild(tooltipElement);
			positionTooltip();
			tooltipElement.style.opacity = '1';
		}, 500);
	}

	function hide() {
		if (timeout) clearTimeout(timeout);
		if (tooltipElement) {
			tooltipElement.remove();
			tooltipElement = null;
		}
	}

	node.addEventListener('mouseenter', show);
	node.addEventListener('mouseleave', hide);
	node.addEventListener('touchstart', hide);

	return {
		update(newText: string) {
			text = newText;
		},
		destroy() {
			hide();
			node.removeEventListener('mouseenter', show);
			node.removeEventListener('mouseleave', hide);
			node.removeEventListener('touchstart', hide);
		}
	};
}
