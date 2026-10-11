import * as Ariakit from '@ariakit/react'
import Script from 'next/script'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { authProviderButtonStyles, authProviderIconSlotStyles, LastUsedCorner } from '~/auth/AuthDialog'
import { GOOGLE_WEB_CLIENT_ID } from '~/constants'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { BusyGlyph, InlineStatus } from '~/ui/Status'

type CodeResponse = { code?: string; error?: string }
type CodeClient = { requestCode: () => void }

type RevocationResponse = {
	error?: string
	successful: boolean
}

type GoogleIdentity = {
	accounts: {
		id: {
			revoke: (loginHint: string, callback: (response: RevocationResponse) => void) => void
		}
		oauth2: {
			initCodeClient: (options: {
				client_id: string
				scope: string
				ux_mode: 'popup'
				callback: (response: CodeResponse) => void
				error_callback: (error: { type: string }) => void
			}) => CodeClient
		}
	}
}

declare global {
	interface Window {
		google?: GoogleIdentity
	}
}

const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_IDENTITY_TIMEOUT_MS = 10_000
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

export function GoogleSignInButton({
	loading,
	disabled = false,
	lastUsed = false,
	onStart,
	onCode
}: {
	loading: boolean
	disabled?: boolean
	lastUsed?: boolean
	onStart: () => void
	onCode: (code: string) => void
}) {
	const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
	const [popupPending, setPopupPending] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const clientRef = useRef<CodeClient | null>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const latest = useRef({ loading, disabled, onCode })
	if ((disabled || loading) && popupPending) setPopupPending(false)
	useLayoutEffect(() => {
		latest.current = { loading, disabled, onCode }
		// A different method taking over permanently abandons this popup, even if that method later fails.
		if (disabled || loading) clientRef.current = null
	}, [loading, disabled, onCode])
	useLayoutEffect(
		() => () => {
			clientRef.current = null
		},
		[]
	)
	useEffect(() => {
		if (loadStatus !== 'loading') return
		const timer = window.setTimeout(() => setLoadStatus('failed'), GOOGLE_IDENTITY_TIMEOUT_MS)
		return () => window.clearTimeout(timer)
	}, [loadStatus])

	const requestCode = () => {
		if (!window.google || clientRef.current || loading || disabled) return
		// The last failure stays on screen while a retry waits for Google; a code clears it.
		onStart()
		const finish = () => {
			if (clientRef.current !== client) return false
			clientRef.current = null
			setPopupPending(false)
			return !latest.current.disabled && !latest.current.loading
		}
		const client = window.google.accounts.oauth2.initCodeClient({
			client_id: GOOGLE_WEB_CLIENT_ID,
			scope: 'openid email profile',
			ux_mode: 'popup',
			callback: (response) => {
				if (!finish()) return
				if (response.error || !response.code) {
					setError('Google sign-in did not finish. Try again.')
					return
				}
				setError(null)
				latest.current.onCode(response.code)
			},
			error_callback: (response) => {
				if (!finish() || response.type === 'popup_closed') return
				setError('Google could not open. Allow popups and try again.')
			}
		})
		clientRef.current = client
		setPopupPending(true)
		client.requestCode()
	}

	const retryLoad = async () => {
		setLoadStatus('loading')
		document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`)?.remove()
		const loaded = await loadGoogleIdentity().then(
			() => true,
			() => false
		)
		if (!loaded) {
			setLoadStatus('failed')
			return
		}
		// Try again is gone once Google loads, so focus moves on to the button it enabled.
		flushSync(() => setLoadStatus('ready'))
		buttonRef.current?.focus()
	}

	const busy = loading || popupPending
	return (
		<>
			<Script
				id="google-identity-services"
				src={GOOGLE_IDENTITY_SCRIPT_URL}
				strategy="afterInteractive"
				onReady={() => setLoadStatus('ready')}
				onError={() => setLoadStatus('failed')}
			/>
			<Ariakit.Button
				ref={buttonRef}
				type="button"
				className={authProviderButtonStyles}
				disabled={disabled || busy || loadStatus !== 'ready'}
				accessibleWhenDisabled
				aria-busy={busy}
				onClick={requestCode}
			>
				<span className={authProviderIconSlotStyles}>
					{busy || loadStatus === 'loading' ? (
						<BusyGlyph decorative size={14} />
					) : (
						<Icon name="google" className="size-4.5" />
					)}
				</span>
				<span className="min-w-0 truncate">
					{loading
						? 'Signing in…'
						: popupPending
							? 'Waiting for Google…'
							: loadStatus === 'loading'
								? 'Loading Google…'
								: 'Continue with Google'}
				</span>
				{lastUsed ? <LastUsedCorner /> : null}
			</Ariakit.Button>
			{loadStatus === 'failed' ? (
				<div className="mt-2">
					<InlineStatus
						variant="error"
						action={
							<Button type="button" size="sm" disabled={loading || disabled} onClick={() => void retryLoad()}>
								Try again
							</Button>
						}
					>
						Google could not load.
					</InlineStatus>
				</div>
			) : error ? (
				<div className="mt-2">
					<InlineStatus variant="error">{error}</InlineStatus>
				</div>
			) : null}
		</>
	)
}
