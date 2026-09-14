const LOW_QUALITY_NAMES = new Set([
	'test',
	'asdf',
	'qwer',
	'hgh',
	'untitled dashboard',
	'new dashboard',
	'my dashboard'
])
const MIN_NAME_LENGTH = 3

export function isLowQualityDashboardName(name: string | undefined | null): boolean {
	const normalized = (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
	if (normalized.length < MIN_NAME_LENGTH) return true
	return LOW_QUALITY_NAMES.has(normalized)
}
