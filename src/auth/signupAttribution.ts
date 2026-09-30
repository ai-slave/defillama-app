import { getABSeedFromCookie } from '~/utils/abTesting'

const UTM_KEY = 'signup_utm'
const MAX_UTM_LENGTH = 100

interface StoredUtm {
	utmSource?: string
	utmMedium?: string
	utmCampaign?: string
}

export interface SignupAttribution extends StoredUtm {
	abVisitorId?: string
}

function readUtm(): StoredUtm {
	try {
		const raw = localStorage.getItem(UTM_KEY)
		return raw ? (JSON.parse(raw) as StoredUtm) : {}
	} catch {
		return {}
	}
}

export function captureFirstTouchUtm(search: string) {
	const params = new URLSearchParams(search)
	const pick = (name: string) => params.get(name)?.trim().slice(0, MAX_UTM_LENGTH) || undefined
	const utm: StoredUtm = {
		utmSource: pick('utm_source'),
		utmMedium: pick('utm_medium'),
		utmCampaign: pick('utm_campaign')
	}
	if (!utm.utmSource && !utm.utmMedium && !utm.utmCampaign) return
	try {
		if (localStorage.getItem(UTM_KEY)) return
		localStorage.setItem(UTM_KEY, JSON.stringify(utm))
	} catch {
		// Storage can be unavailable; attribution degrades silently.
	}
}

export function getSignupAttribution(): SignupAttribution {
	const utm = readUtm()
	const abVisitorId = typeof document === 'undefined' ? null : getABSeedFromCookie(document.cookie)
	return {
		...(utm.utmSource ? { utmSource: utm.utmSource } : {}),
		...(utm.utmMedium ? { utmMedium: utm.utmMedium } : {}),
		...(utm.utmCampaign ? { utmCampaign: utm.utmCampaign } : {}),
		...(abVisitorId ? { abVisitorId } : {})
	}
}
