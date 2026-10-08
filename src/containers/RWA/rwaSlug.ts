import { LEADING_DASH_REGEX, TRAILING_DASH_REGEX } from '~/utils/regex-constants'
import { safeDecodeURIComponent } from '~/utils/route'

const NON_WORD_REGEX = /[^\w]+/g
const MULTI_DASH_REGEX = /-+/g

// RWA-specific slug: must be safe as a *single* URL segment (no `/`).
export const rwaSlug = (input = ''): string => {
	const normalized = safeDecodeURIComponent(String(input)).toLowerCase().trim()
	return normalized
		.replace(NON_WORD_REGEX, '-')
		.replace(MULTI_DASH_REGEX, '-')
		.replace(LEADING_DASH_REGEX, '')
		.replace(TRAILING_DASH_REGEX, '')
}

export function findByRwaSlug<T extends string>(input: string, values: Array<T>): T | null {
	const inputSlug = rwaSlug(input)

	for (const value of values) {
		if (rwaSlug(value) === inputSlug) return value
	}

	return null
}
