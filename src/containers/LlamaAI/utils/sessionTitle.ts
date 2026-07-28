const PLACEHOLDER_MAX_CHARS = 50

export function placeholderTitleFromMessage(message?: string | null): string | null {
	if (!message) return null
	const normalized = message.replace(/\s+/g, ' ').trim()
	if (!normalized) return null
	if (normalized.length <= PLACEHOLDER_MAX_CHARS) return normalized
	const cut = normalized.slice(0, PLACEHOLDER_MAX_CHARS)
	const lastSpace = cut.lastIndexOf(' ')
	return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()
}
