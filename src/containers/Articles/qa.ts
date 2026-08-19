export function normalizeQAQuestionNumber(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const digits = value.replace(/\D/g, '').slice(0, 4)
	return digits || null
}

export function formatAutomaticQAQuestionNumber(index: number): string {
	return String(Math.max(1, index)).padStart(2, '0')
}
