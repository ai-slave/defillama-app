import { useEffect } from 'react'
import { setReferrer } from '~/auth/referrer'

// Reading the URL owns the try/catch: the compiler cannot lower the loop's logical test inside one, and
// a plain module function is not compiled at all.
function readReferrerParam(): string | null {
	try {
		const params = new URLSearchParams(window.location.search)
		for (const [key, value] of params.entries()) {
			if (key.toLowerCase() === 'ref' && value) return value
		}
		return null
	} catch {
		// URL parsing can fail on odd locations; no referrer is recorded.
		return null
	}
}

export function useReferrer() {
	useEffect(() => {
		if (typeof window === 'undefined') return
		const referrer = readReferrerParam()
		if (referrer) setReferrer(referrer)
	}, [])
}
