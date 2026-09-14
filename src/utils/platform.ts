export function isMacPlatform(): boolean {
	if (typeof navigator === 'undefined') return false
	return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent)
}
