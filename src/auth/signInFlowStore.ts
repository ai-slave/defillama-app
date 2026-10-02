export type GoogleLinkChallenge = {
	challengeToken: string
	expiresAt: string
	kind: 'link_verification_required'
	resendAfter: string
}

type StandardScreen = 'signin' | 'signup' | 'wallet'
type SignInError = { message: string; method: 'email' | 'google' | 'github' }

type StandardState = {
	error?: SignInError
	pendingGoogleLink?: GoogleLinkChallenge
} & ({ kind: 'signin' } | { kind: 'signup' } | { kind: 'wallet' } | { kind: 'forgot'; email: string })

export type SignInFlowState = (
	| StandardState
	| { challenge: GoogleLinkChallenge; error?: SignInError; kind: 'googleLink' }
) & {
	/** This flow's own sign-in finished. Set in the same update as the session it saved, so a session the flow did
	    not finish came from another tab. */
	finished?: true
}

export type SignInFlowEvent =
	| { kind: 'authenticated' }
	| { error: string; kind: 'failed'; method?: SignInError['method'] }
	| { kind: 'googleLinkExpired' }
	| { challenge: GoogleLinkChallenge; kind: 'googleLinkRequired' }
	| { challenge: GoogleLinkChallenge; kind: 'googleLinkUpdated' }
	| ({ kind: 'navigate' } & ({ screen: StandardScreen } | { screen: 'forgot'; email: string }))
	| { kind: 'requestStarted' }
	| { kind: 'resumeGoogleLink' }
	| { kind: 'useAnotherMethod' }

export type SignInFlowStore = ReturnType<typeof createSignInFlowStore>

const STORAGE_KEY = 'google-link-challenge'

function removeStoredChallenge() {
	if (typeof window === 'undefined') return
	try {
		window.sessionStorage.removeItem(STORAGE_KEY)
	} catch {
		// Storage can be unavailable or full; the feature degrades silently.
	}
}

function storeChallenge(challenge: GoogleLinkChallenge) {
	if (typeof window === 'undefined') return
	try {
		window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(challenge))
	} catch {
		// Storage can be unavailable or full; the feature degrades silently.
	}
}

export function isGoogleLinkChallenge(value: unknown): value is GoogleLinkChallenge {
	if (!value || typeof value !== 'object') return false
	const challenge = value as Partial<GoogleLinkChallenge>
	const expiresAt = typeof challenge.expiresAt === 'string' ? Date.parse(challenge.expiresAt) : NaN
	const resendAfter = typeof challenge.resendAfter === 'string' ? Date.parse(challenge.resendAfter) : NaN
	return (
		challenge.kind === 'link_verification_required' &&
		typeof challenge.challengeToken === 'string' &&
		challenge.challengeToken.length > 0 &&
		Number.isFinite(expiresAt) &&
		Number.isFinite(resendAfter) &&
		resendAfter < expiresAt
	)
}

function readStoredChallenge() {
	if (typeof window === 'undefined') return undefined
	try {
		const stored = window.sessionStorage.getItem(STORAGE_KEY)
		if (!stored) return undefined
		const challenge: unknown = JSON.parse(stored)
		if (!isGoogleLinkChallenge(challenge) || Date.parse(challenge.expiresAt) <= Date.now()) {
			removeStoredChallenge()
			return undefined
		}
		return challenge
	} catch {
		removeStoredChallenge()
		return undefined
	}
}

function reduceSignInFlow(state: SignInFlowState, event: SignInFlowEvent): SignInFlowState {
	switch (event.kind) {
		case 'authenticated':
			return { kind: 'signin', finished: true }
		case 'failed':
			return { ...state, error: event.error ? { message: event.error, method: event.method ?? 'email' } : undefined }
		case 'googleLinkExpired':
			return {
				error: {
					message: 'Verification code expired. Continue with Google again to request a new code.',
					method: 'google'
				},
				kind: 'signin'
			}
		case 'googleLinkRequired':
		case 'googleLinkUpdated':
			return { challenge: event.challenge, kind: 'googleLink' }
		case 'navigate':
			return {
				...(event.screen === 'forgot' ? { kind: event.screen, email: event.email } : { kind: event.screen }),
				pendingGoogleLink: state.kind === 'googleLink' ? state.challenge : state.pendingGoogleLink
			}
		case 'requestStarted':
			return { ...state, error: undefined }
		case 'resumeGoogleLink':
			return state.kind !== 'googleLink' && state.pendingGoogleLink
				? { challenge: state.pendingGoogleLink, kind: 'googleLink' }
				: state
		case 'useAnotherMethod':
			return state.kind === 'googleLink'
				? { kind: 'signin', pendingGoogleLink: state.challenge }
				: { kind: 'signin', pendingGoogleLink: state.pendingGoogleLink }
	}
}

export function createSignInFlowStore(initialScreen: 'signin' | 'signup' = 'signin') {
	const storedChallenge = readStoredChallenge()
	let state: SignInFlowState = storedChallenge
		? { challenge: storedChallenge, kind: 'googleLink' }
		: { kind: initialScreen }
	const serverState: SignInFlowState = { kind: initialScreen }
	const listeners = new Set<() => void>()

	let authRequest: AbortController | undefined
	const cancelAuthRequest = () => authRequest?.abort()

	return {
		beginAuthRequest() {
			cancelAuthRequest()
			authRequest = new AbortController()
			return authRequest.signal
		},
		cancelAuthRequest,
		dispatch(event: SignInFlowEvent) {
			if (event.kind === 'navigate' && event.screen !== 'forgot' && event.screen === state.kind) return
			cancelAuthRequest()
			const nextState = reduceSignInFlow(state, event)
			if (event.kind === 'googleLinkRequired' || event.kind === 'googleLinkUpdated') {
				storeChallenge(event.challenge)
			} else if (event.kind === 'authenticated' || event.kind === 'googleLinkExpired') {
				removeStoredChallenge()
			}
			if (nextState === state) return
			state = nextState
			for (const listener of listeners) listener()
		},
		getServerSnapshot: () => serverState,
		getSnapshot: () => state,
		subscribe(listener: () => void) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		}
	}
}
