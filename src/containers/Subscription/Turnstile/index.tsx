import { Turnstile as TurnstileWidget, type TurnstileInstance } from '@marsidev/react-turnstile'
import type { Ref } from 'react'
import { useDarkModeManager } from '~/contexts/LocalStorage'

interface TurnstileProps {
	action?: string
	ref?: Ref<TurnstileInstance | undefined>
	onVerify: (token: string) => void
	onError?: () => void
	onExpire?: () => void
}

export function Turnstile({ onVerify, onError, onExpire, action, ref }: TurnstileProps) {
	const [isDarkMode] = useDarkModeManager()
	const theme: 'light' | 'dark' = isDarkMode ? 'dark' : 'light'
	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAABjeuAHi7HNPyGmv'

	return (
		<div className="flex justify-center">
			<TurnstileWidget
				ref={ref}
				siteKey={siteKey}
				onSuccess={onVerify}
				onError={onError}
				onExpire={onExpire}
				onTimeout={onExpire}
				onUnsupported={onError}
				options={{
					...(action ? { action } : {}),
					theme,
					size: 'flexible',
					appearance: 'always'
				}}
			/>
		</div>
	)
}
