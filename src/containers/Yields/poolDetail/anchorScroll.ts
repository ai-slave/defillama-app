/**
 * A panel ref for panels that mount after the page (measured props fetched client-side) has already missed the
 * browser's own anchor scroll: the panel scrolls itself into view when the URL names it.
 */
export function scrollIntoViewIfHashed(panel: HTMLElement | null) {
	if (panel && window.location.hash === `#${panel.id}`) panel.scrollIntoView({ block: 'start' })
}
