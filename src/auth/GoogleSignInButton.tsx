import Script from 'next/script'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { authProviderButtonStyles, LastUsedChip } from '~/auth/AuthDialog'
import { GOOGLE_WEB_CLIENT_ID } from '~/constants'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

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
		setError(null)
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
					setError('Google sign-in was not completed. Please try again.')
					return
				}
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
		try {
			await loadGoogleIdentity()
			setLoadStatus('ready')
		} catch {
			setLoadStatus('failed')
		}
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
			<button
				type="button"
				className={`${authProviderButtonStyles} relative ${lastUsed ? 'max-[380px]:pr-19' : ''}`}
				disabled={disabled || busy || loadStatus !== 'ready'}
				aria-busy={busy}
				onClick={requestCode}
			>
				{busy || loadStatus === 'loading' ? (
					<LoadingSpinner size={14} />
				) : (
					<Icon name="google" height={18} width={18} className="shrink-0" />
				)}
				<span>
					{loading
						? 'Signing in...'
						: popupPending
							? 'Waiting for Google...'
							: loadStatus === 'loading'
								? 'Loading Google...'
								: 'Continue with Google'}
				</span>
				{lastUsed ? (
					<span className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2">
						<LastUsedChip />
					</span>
				) : null}
			</button>
			{loadStatus === 'failed' ? (
				<p role="alert" className="mt-2 text-center text-xs text-error">
					Google could not load.{' '}
					<button
						type="button"
						disabled={loading || disabled}
						onClick={() => void retryLoad()}
						className="text-link disabled:opacity-60"
					>
						Try again
					</button>
				</p>
			) : error ? (
				<p role="alert" className="mt-2 text-left text-xs text-error">
					{error}
				</p>
			) : null}
		</>
	)
}
