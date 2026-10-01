import { useQuery } from '@tanstack/react-query'

const iconValidityCache = new Map<string, boolean | Promise<boolean>>()

/** Probe an image URL once; concurrent callers share the same in-flight request. */
function validateIconUrl(url: string): Promise<boolean> {
	const cached = iconValidityCache.get(url)
	if (typeof cached === 'boolean') return Promise.resolve(cached)
	if (cached) return cached
	if (typeof Image === 'undefined') return Promise.resolve(false)

	const pending = new Promise<boolean>((resolve) => {
		const image = new Image()
		image.addEventListener(
			'load',
			() => {
				iconValidityCache.set(url, true)
				resolve(true)
			},
			{ once: true }
		)
		image.addEventListener(
			'error',
			() => {
				iconValidityCache.set(url, false)
				resolve(false)
			},
			{ once: true }
		)
		image.src = url
	})
	iconValidityCache.set(url, pending)
	return pending
}

const NO_ICONS: ReadonlySet<string> = new Set()

/**
 * The URLs in `urls` that load as images. Empty until every probe of this exact set settles, so a chart never
 * mixes icons from a previous set; a set seen before is ready on the first render.
 */
export function useLoadedIconUrls(urls: Array<string>): ReadonlySet<string> {
	const { data } = useQuery({
		queryKey: ['chart-icon-urls', urls],
		queryFn: async () => {
			const loaded = await Promise.all(urls.map(validateIconUrl))
			const valid = new Set<string>()
			for (let index = 0; index < urls.length; index++) {
				if (loaded[index]) valid.add(urls[index])
			}
			return valid
		},
		enabled: urls.length > 0,
		staleTime: Infinity
	})
	return data ?? NO_ICONS
}
