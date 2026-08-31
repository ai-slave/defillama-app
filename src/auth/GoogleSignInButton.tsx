import Script from 'next/script'
import { useCallback, useId, useRef } from 'react'
import { GOOGLE_WEB_CLIENT_ID } from '~/constants'
import { LoadingSpinner } from '~/ui/Loaders'

type CredentialResponse = {
	credential?: string
	state?: string
}

type RevocationResponse = {
	error?: string
	successful: boolean
}

type GoogleIdentity = {
	accounts: {
		id: {
			initialize: (options: { callback: (response: CredentialResponse) => void; client_id: string }) => void
			revoke: (loginHint: string, callback: (response: RevocationResponse) => void) => void
			renderButton: (
				parent: HTMLElement,
				options: {
					shape: 'rectangular'
					size: 'large'
					state: string
					text: 'continue_with'
					theme: 'outline'
					width: number
				}
			) => void
		}
	}
}

declare global {
	interface Window {
		google?: GoogleIdentity
	}
}

const credentialHandlers = new Map<string, (credential: string) => void>()
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_IDENTITY_TIMEOUT_MS = 10_000
let initialized = false
let googleIdentityLoadPromise: Promise<GoogleIdentity> | null = null

function loadGoogleIdentity(): Promise<GoogleIdentity> {
	if (window.google) return Promise.resolve(window.google)
	if (googleIdentityLoadPromise) return googleIdentityLoadPromise

	googleIdentityLoadPromise = new Promise<GoogleIdentity>((resolve, reject) => {
		const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`)
		const script = existingScript ?? document.createElement('script')
		const timeout = window.setTimeout(
			() => reject(new Error('Google Identity Services failed to load')),
			GOOGLE_IDENTITY_TIMEOUT_MS
		)
		const settle = () => {
			window.clearTimeout(timeout)
			if (window.google) resolve(window.google)
			else reject(new Error('Google Identity Services is unavailable'))
		}
		script.addEventListener('load', settle, { once: true })
		script.addEventListener(
			'error',
			() => {
				window.clearTimeout(timeout)
				reject(new Error('Google Identity Services failed to load'))
			},
			{ once: true }
		)
		if (!existingScript) {
			script.async = true
			script.src = GOOGLE_IDENTITY_SCRIPT_URL
			document.head.appendChild(script)
		}
	}).catch((error) => {
		googleIdentityLoadPromise = null
		throw error
	})

	return googleIdentityLoadPromise
}

export async function revokeGoogleCredentialSharing(loginHint: string): Promise<void> {
	const google = await loadGoogleIdentity()
	return new Promise((resolve, reject) => {
		let settled = false
		const settle = (callback: () => void) => {
			if (settled) return
			settled = true
			window.clearTimeout(timeout)
			callback()
		}
		const timeout = window.setTimeout(
			() => settle(() => reject(new Error('Google credential revocation timed out'))),
			GOOGLE_IDENTITY_TIMEOUT_MS
		)

		try {
			google.accounts.id.revoke(loginHint, (response) => {
				if (response.successful) {
					settle(resolve)
					return
				}
				settle(() => reject(new Error(response.error || 'Google credential revocation failed')))
			})
		} catch (error) {
			settle(() => reject(error))
		}
	})
}

function initializeGoogle() {
	if (initialized || !window.google) return
	window.google.accounts.id.initialize({
		client_id: GOOGLE_WEB_CLIENT_ID,
		callback: (response) => {
			if (!response.state || !response.credential) return
			credentialHandlers.get(response.state)?.(response.credential)
		}
	})
	initialized = true
}

export function GoogleSignInButton({
	loading,
	onCredential
}: {
	loading: boolean
	onCredential: (token: string) => void
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const state = useId()

	const renderButton = useCallback(() => {
		const container = containerRef.current
		if (!window.google || !container) return
		initializeGoogle()
		credentialHandlers.set(state, onCredential)
		container.replaceChildren()
		window.google.accounts.id.renderButton(container, {
			shape: 'rectangular',
			size: 'large',
			state,
			text: 'continue_with',
			theme: 'outline',
			width: Math.min(400, container.clientWidth)
		})
	}, [onCredential, state])

	const setContainer = useCallback(
		(container: HTMLDivElement | null) => {
			containerRef.current = container
			if (container) renderButton()
			else credentialHandlers.delete(state)
		},
		[renderButton, state]
	)

	return (
		<>
			<Script
				id="google-identity-services"
				src={GOOGLE_IDENTITY_SCRIPT_URL}
				strategy="afterInteractive"
				onReady={renderButton}
			/>
			<div className="relative h-10">
				<div ref={setContainer} className={loading ? 'pointer-events-none h-10 opacity-0' : 'h-10'} />
				{loading ? (
					<div className="absolute inset-0 flex items-center justify-center gap-2 rounded-sm border border-medium bg-signin-bg text-sm text-primary">
						<LoadingSpinner size={14} />
						<span>Signing in...</span>
					</div>
				) : null}
			</div>
		</>
	)
}
