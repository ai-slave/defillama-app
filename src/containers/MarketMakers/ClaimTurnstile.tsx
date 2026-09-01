import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { forwardRef } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'

interface ClaimTurnstileProps {
	onVerify: (token: string) => void
	onError: () => void
	className?: string
}

export function isClaimTurnstileEnabled(): boolean {
	return Boolean(process.env.NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY?.trim())
}

export const ClaimTurnstile = forwardRef<TurnstileInstance | undefined, ClaimTurnstileProps>(function ClaimTurnstile(
	{ onVerify, onError, className },
	ref
) {
	const [isDarkMode] = useDarkModeManager()
	const siteKey = process.env.NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY?.trim()

	if (!siteKey) return null

	return (
		<div className={className}>
			<Turnstile
				ref={ref}
				siteKey={siteKey}
				onSuccess={onVerify}
				onError={onError}
				onExpire={onError}
				onTimeout={onError}
				onUnsupported={onError}
				options={{
					action: 'claim',
					theme: isDarkMode ? 'dark' : 'light',
					size: 'flexible',
					appearance: 'always',
					responseField: false
				}}
			/>
		</div>
	)
})
