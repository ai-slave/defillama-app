import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import { Turnstile } from '~/containers/Subscription/Turnstile'
import { Icon } from '~/ui/Icon'

interface PasswordResetModalProps {
	isOpen: boolean
	onClose: () => void
	email: string
	sent: boolean
	onSend: (turnstileToken: string) => void
	isPending: boolean
	cooldownMessage: string
}

export function PasswordResetModal({
	isOpen,
	onClose,
	email,
	sent,
	onSend,
	isPending,
	cooldownMessage
}: PasswordResetModalProps) {
	const turnstileToken = useRef('')
	// Turnstile tokens are single-use; remount the widget after every send.
	const [captchaRetry, setCaptchaRetry] = useState(0)
	const [captchaMessage, setCaptchaMessage] = useState('')

	const handleSend = () => {
		const token = turnstileToken.current
		if (!token) {
			setCaptchaMessage('Complete the CAPTCHA verification.')
			return
		}
		setCaptchaMessage('')
		turnstileToken.current = ''
		setCaptchaRetry((retry) => retry + 1)
		onSend(token)
	}

	return (
		<Ariakit.DialogProvider open={isOpen} setOpen={(open) => !open && onClose()}>
			<Ariakit.Dialog
				backdrop={<div className="bg-black/80" />}
				className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[331px]"
				portal
				unmountOnHide
			>
				<div className="flex flex-col gap-5 px-5 py-6">
					<div className="flex items-center justify-between">
						<h3 className="text-xl leading-7 font-semibold text-sub-text-primary">Change Password</h3>
						<Ariakit.DialogDismiss className="rounded-full p-1 text-sub-text-primary transition-colors">
							<Icon name="x" height={24} width={24} />
						</Ariakit.DialogDismiss>
					</div>

					<div className="flex flex-col gap-8">
						<div className="text-sm leading-[21px] text-sub-text-primary">
							{sent ? (
								<>
									<p className="mb-3.5">We sent a reset password link to {email}.</p>
									<p>Tap it to change your password.</p>
								</>
							) : (
								<p>We&apos;ll send a reset password link to {email}.</p>
							)}
						</div>

						<div className="flex flex-col gap-3">
							<div inert={isPending}>
								<Turnstile
									key={captchaRetry}
									onVerify={(token) => {
										turnstileToken.current = token
									}}
									onError={() => {
										turnstileToken.current = ''
									}}
									onExpire={() => {
										turnstileToken.current = ''
									}}
									className="flex justify-center"
								/>
							</div>
							{sent ? (
								<div className="flex items-center gap-1 text-sm leading-[21px]">
									<span className="text-sub-text-primary">Didn&apos;t receive it?</span>
									<button
										type="button"
										onClick={handleSend}
										disabled={isPending}
										className="text-sub-brand-secondary underline disabled:opacity-50"
									>
										Resend email
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={handleSend}
									disabled={isPending}
									className="flex h-10 items-center justify-center rounded-lg bg-sub-brand-secondary px-4 text-sm font-medium text-white disabled:opacity-50"
								>
									{isPending ? 'Sending...' : 'Send reset link'}
								</button>
							)}
							{captchaMessage && <p className="text-xs text-sub-warning-text-dark">{captchaMessage}</p>}
							{cooldownMessage && <p className="text-xs text-sub-warning-text-dark">{cooldownMessage}</p>}
						</div>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
