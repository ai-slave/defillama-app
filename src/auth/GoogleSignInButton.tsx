import Script from 'next/script'
import { useCallback, useId, useRef } from 'react'
import { GOOGLE_WEB_CLIENT_ID } from '~/constants'
import { LoadingSpinner } from '~/ui/Loaders'

type CredentialResponse = {
	credential?: string
	state?: string
}

type GoogleIdentity = {
	accounts: {
		id: {
			initialize: (options: { callback: (response: CredentialResponse) => void; client_id: string }) => void
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
let initialized = false

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
				src="https://accounts.google.com/gsi/client"
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
