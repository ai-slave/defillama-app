function textOf(element: Element): string {
	const copy = element.cloneNode(true) as Element
	for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
	return copy.textContent.trim()
}

/** The name a user or screen reader gets for an element, in the browser's order: aria-labelledby, aria-label, the
    `<label for>` that points at it (a Field's visible label), else its text outside aria-hidden subtrees. */
export function accessibleName(element: Element): string {
	const labelledBy = element.getAttribute('aria-labelledby')
	if (labelledBy) {
		return labelledBy
			.split(/\s+/)
			.map((id) => element.ownerDocument.getElementById(id))
			.filter((node) => node !== null)
			.map(textOf)
			.join(' ')
	}
	const label = element.getAttribute('aria-label')
	if (label !== null) return label
	const labels = (element as HTMLButtonElement).labels
	if (labels && labels.length > 0) return [...labels].map(textOf).join(' ')
	return textOf(element)
}
