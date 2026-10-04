import { useState } from 'react'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'

const COOLDOWN_SECONDS = 60

interface ResendCooldownProps {
	/** When the last code was sent (unix seconds); the countdown runs from it, so it holds however late this mounts. */
	sentAtSeconds: number | null
	onResend: () => void
	disabled: boolean
	/** Set while the resend request runs. */
	pending: boolean
}

export function ResendCooldown({ sentAtSeconds, onResend, disabled, pending }: ResendCooldownProps) {
	const nowSeconds = useNowSeconds(undefined, 1000)
	// The code that brought this step up was sent before it mounted; a later send time is a resend.
	const [firstSentAt] = useState(sentAtSeconds)
	const secondsLeft = sentAtSeconds === null ? 0 : Math.max(0, COOLDOWN_SECONDS - (nowSeconds - sentAtSeconds))

	return (
		<>
			<div className="flex items-center gap-1 body-sm text-secondary">
				<span>Didn't receive the code?</span>
				{/* Focusable through the countdown: a sent code starts it while the button still has focus. */}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					pendingLabel={pending ? 'Sending code…' : null}
					disabled={disabled || secondsLeft > 0}
					accessibleWhenDisabled
					onClick={onResend}
				>
					{secondsLeft > 0 ? `Resend code (${secondsLeft}s)` : 'Resend code'}
				</Button>
			</div>
			{sentAtSeconds !== firstSentAt && !pending ? (
				<p role="status" className="body-sm text-secondary">
					Code sent. Check your inbox.
				</p>
			) : null}
		</>
	)
}
