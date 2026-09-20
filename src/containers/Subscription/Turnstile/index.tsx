import { Turnstile as TurnstileWidget } from '@marsidev/react-turnstile'
import { useDarkModeManager } from '~/contexts/LocalStorage'

interface TurnstileProps {
	onVerify: (token: string) => void
	onError?: () => void
	onExpire?: () => void
}

export function Turnstile({ onVerify, onError, onExpire }: TurnstileProps) {
	const [isDarkMode] = useDarkModeManager()
	const theme: 'light' | 'dark' = isDarkMode ? 'dark' : 'light'
	const siteKey = '0x4AAAAAABjeuAHi7HNPyGmv'

	return (
		<div className="flex justify-center">
			<TurnstileWidget
				siteKey={siteKey}
				onSuccess={onVerify}
				onError={onError}
				onExpire={onExpire}
				options={{
					theme,
					size: 'normal',
					appearance: 'always'
				}}
			/>
		</div>
	)
}
