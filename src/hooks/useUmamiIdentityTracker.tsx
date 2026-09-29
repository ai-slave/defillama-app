import { useEffect, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { UMAMI_READY_EVENT } from '~/utils/analytics/umami'

export function useUmamiIdentityTracker() {
	const { user } = useAuthContext()
	const lastIdentifiedIdRef = useRef<string | null>(null)
	const shouldSkipIdentify = user?.flags?.is_llama === true
	const distinctId = user?.id ?? null

	useEffect(() => {
		if (!distinctId) {
			lastIdentifiedIdRef.current = null
			return
		}
		if (shouldSkipIdentify) return

		// Umami loads lazily, so the user may resolve before or after it does.
		const identifyCurrentUser = () => {
			const umami = window.umami
			if (!umami || lastIdentifiedIdRef.current === distinctId) return
			umami.identify(distinctId)
			lastIdentifiedIdRef.current = distinctId
			umami.track()
		}

		identifyCurrentUser()
		window.addEventListener(UMAMI_READY_EVENT, identifyCurrentUser)
		return () => window.removeEventListener(UMAMI_READY_EVENT, identifyCurrentUser)
	}, [distinctId, shouldSkipIdentify])
}
