const iconValidityCache = new Map<string, boolean | Promise<boolean>>()

/** Returns true after {@link validateIconUrl} has confirmed that the URL loads. */
export function isIconUrlValid(url: string): boolean {
	return iconValidityCache.get(url) === true
}

/** Probe an image URL once; concurrent callers share the same in-flight request. */
export function validateIconUrl(url: string): Promise<boolean> {
	const cached = iconValidityCache.get(url)
	if (typeof cached === 'boolean') return Promise.resolve(cached)
	if (cached) return cached
	if (typeof Image === 'undefined') return Promise.resolve(false)

	const pending = new Promise<boolean>((resolve) => {
		const image = new Image()
		image.onload = () => {
			iconValidityCache.set(url, true)
			resolve(true)
		}
		image.onerror = () => {
			iconValidityCache.set(url, false)
			resolve(false)
		}
		image.src = url
	})
	iconValidityCache.set(url, pending)
	return pending
}
