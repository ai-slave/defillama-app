export function scrollToPageTop() {
	if (typeof window === 'undefined') return
	window.scrollTo(0, 0)
}
