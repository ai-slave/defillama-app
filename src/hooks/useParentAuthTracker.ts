import { useEffect } from 'react'
import { useInvestorsSite } from '~/containers/Investors/SiteContext'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'
import { checkParentAuth } from '~/utils/checkParentAuth'

// Only runs on investor hosts, including when both sites share one deployment.

const SESSION_KEY = 'ir-parent-auth-tracked'

export function useParentAuthTracker() {
	const site = useInvestorsSite()
	useEffect(() => {
		if (!site) return
		if (typeof window === 'undefined') return
		if (sessionStorage.getItem(SESSION_KEY)) {
			console.log('[auth-tracker] already tracked this session:', sessionStorage.getItem(SESSION_KEY))
			return
		}

		let canceled = false
		let trackVisit: (() => void) | null = null

		checkParentAuth().then((user) => {
			if (canceled) return
			if (!user) {
				console.log('[auth-tracker] no parent auth detected')
				return
			}

			console.log('[auth-tracker] authenticated user:', user.id)
			// Umami loads lazily, so the visit is sent now or when it is ready. The session counts as tracked only
			// once it is sent: a visitor who leaves first is tracked on their next page load.
			trackVisit = () => {
				const umami = window.umami
				if (!umami || sessionStorage.getItem(SESSION_KEY)) return
				umami.identify(user.id ?? 'unknown')
				umami.track('ir-authenticated-visit', {
					userId: user.id
				})
				sessionStorage.setItem(SESSION_KEY, user.id ?? 'unknown')
			}
			trackVisit()
			window.addEventListener(UMAMI_READY_EVENT, trackVisit)
		})

		return () => {
			canceled = true
			if (trackVisit) window.removeEventListener(UMAMI_READY_EVENT, trackVisit)
		}
	}, [site])
}
