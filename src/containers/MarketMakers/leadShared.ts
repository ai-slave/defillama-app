export const SOCIAL_PROFILE_PATTERN = /^(https?:\/\/)?(www\.)?(linkedin\.com|x\.com|twitter\.com)\/.+/i

export function normalizeSocialUrl(url: string): string {
	return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
