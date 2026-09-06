export type GoogleLinkChallenge = {
	challengeToken: string
	expiresAt: string
	kind: 'link_verification_required'
	resendAfter: string
}

type StandardScreen = 'forgot' | 'signin' | 'signup' | 'wallet'

type StandardState = {
	error?: string
	kind: StandardScreen
	pendingGoogleLink?: GoogleLinkChallenge
}

export type SignInFlowState = StandardState | { challenge: GoogleLinkChallenge; error?: string; kind: 'googleLink' }

export type SignInFlowEvent =
	| { kind: 'authenticated' }
	| { error: string; kind: 'failed' }
	| { kind: 'googleLinkExpired' }
	| { challenge: GoogleLinkChallenge; kind: 'googleLinkRequired' }
	| { challenge: GoogleLinkChallenge; kind: 'googleLinkUpdated' }
	| { kind: 'navigate'; screen: StandardScreen }
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
			return { kind: 'signin' }
		case 'failed':
			return { ...state, error: event.error }
		case 'googleLinkExpired':
			return {
				error: 'Verification code expired. Continue with Google again to request a new code.',
				kind: 'signin'
			}
		case 'googleLinkRequired':
		case 'googleLinkUpdated':
			return { challenge: event.challenge, kind: 'googleLink' }
		case 'navigate':
			return {
				kind: event.screen,
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

	return {
		dispatch(event: SignInFlowEvent) {
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
