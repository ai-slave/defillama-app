/** The name a user or screen reader gets for an element: its aria-label, else its text outside aria-hidden subtrees. */
export function accessibleName(element: Element): string {
	const label = element.getAttribute('aria-label')
	if (label !== null) return label
	const copy = element.cloneNode(true) as Element
	for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
	return copy.textContent.trim()
}
