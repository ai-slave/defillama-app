/** DefiLlama logo watermark for an ECharts `graphic` option. */
export function buildWatermarkGraphic(isDark: boolean, height = 40) {
	return {
		type: 'image',
		zlevel: 10,
		z: 999,
		silent: true,
		left: 'center',
		top: 'middle',
		style: {
			image: isDark ? '/assets/defillama-light-neutral.webp' : '/assets/defillama-dark-neutral.webp',
			width: Math.round((389 / 133) * height),
			height,
			opacity: 0.3
		}
	}
}
