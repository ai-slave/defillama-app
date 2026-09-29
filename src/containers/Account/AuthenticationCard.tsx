import { useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { EmailChangeModal } from './EmailChangeModal'
import { PasswordResetModal } from './PasswordResetModal'
import { SwitchToEmailModal } from './SwitchToEmailModal'
import { isWalletEmail, truncateAddress } from './utils'

export function AuthenticationCard() {
	const { user, resetPasswordMutation, promptVerifyEmail } = useAuthContext()

	const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
	const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
	const [isSwitchToEmailModalOpen, setIsSwitchToEmailModalOpen] = useState(false)
	const [passwordCooldownMsg, setPasswordCooldownMsg] = useState('')
	const [isPasswordResetSent, setIsPasswordResetSent] = useState(false)
	const passwordResetSentAt = useRef(0)
	const PASSWORD_COOLDOWN_MS = 60_000

	const walletEmail = isWalletEmail(user?.email)
	const isEmailUnverified = !walletEmail && user?.verified === false
	const walletAddress = user?.walletAddress
	const walletDisplayName = walletAddress ? truncateAddress(walletAddress) : ''

	const handleChangeEmail = () => {
		setIsEmailModalOpen(true)
	}

	const handleChangePassword = () => {
		if (!user?.email) return
		// A new opening starts without the last opening's failure; the reset mutation is shared, so the dialog cannot.
		resetPasswordMutation.reset()
		setPasswordCooldownMsg('')
		setIsPasswordModalOpen(true)
	}

	// The modal collects the captcha token; the reset email goes through the features server.
	const handleSendPasswordReset = (turnstileToken: string) => {
		if (!user?.email) return
		const elapsed = Date.now() - passwordResetSentAt.current
		if (elapsed < PASSWORD_COOLDOWN_MS) {
			const secondsLeft = Math.ceil((PASSWORD_COOLDOWN_MS - elapsed) / 1000)
			setPasswordCooldownMsg(`Wait ${secondsLeft}s before resending.`)
			return
		}
		setPasswordCooldownMsg('')
		resetPasswordMutation.mutate(
			{ email: user.email, turnstileToken },
			{
				onSuccess: () => {
					passwordResetSentAt.current = Date.now()
					setIsPasswordResetSent(true)
				}
			}
		)
	}

	const handleVerifyEmail = () => {
		if (!user?.email) return
		promptVerifyEmail(user.id)
	}

	return (
		<>
			<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
				<div className="flex items-center gap-2">
					<Icon name="key-filled" height={28} width={28} className="text-sub-text-primary" />
					<span className="label-lg text-sub-text-primary">Authentication</span>
				</div>

				<p className="body-sm text-sub-text-muted">Manage your authentication methods.</p>

				{walletEmail ? (
					<>
						<div className="flex items-center gap-3">
							<div className="flex items-center rounded-full bg-sub-surface-panel p-2 dark:bg-sub-dark-page">
								<Icon name="wallet" height={20} width={20} className="text-sub-text-primary" />
							</div>
							<div className="flex flex-col gap-1">
								<span className="body-md text-sub-text-primary">{walletDisplayName}</span>
								<span className="body-sm text-sub-text-muted">Wallet Address</span>
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<div className="flex items-center justify-between gap-3">
								<div className="flex flex-col gap-1">
									<span className="body-md text-sub-text-primary">Email &amp; Password</span>
									<span className="body-sm text-sub-text-muted">Not set up</span>
								</div>
								<Button type="button" size="md" onClick={() => setIsSwitchToEmailModalOpen(true)}>
									Enable Email Auth
								</Button>
							</div>
							<p className="body-sm text-sub-text-muted">
								Add email &amp; password as another way to log in to your account.
							</p>
						</div>
					</>
				) : (
					<>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<div className="flex items-center rounded-full bg-sub-surface-panel p-2 dark:bg-sub-dark-page">
									<Icon name="mail-rounded" height={20} width={20} className="text-sub-text-primary" />
								</div>
								<div className="flex flex-col gap-1">
									<span className="body-md text-sub-text-primary">{user?.email}</span>
									<span className="body-sm text-sub-text-muted">Email & Password</span>
								</div>
							</div>
							<div className="flex gap-2">
								<Button type="button" size="md" onClick={handleChangeEmail}>
									Change Email
								</Button>
								<Button
									type="button"
									size="md"
									onClick={handleChangePassword}
									disabled={resetPasswordMutation.isPending}
								>
									Change Password
								</Button>
							</div>
						</div>

						{user?.walletAddress && (
							<div className="flex items-center gap-3">
								<div className="flex items-center rounded-full bg-sub-surface-panel p-2 dark:bg-sub-dark-page">
									<Icon name="wallet" height={20} width={20} className="text-sub-text-primary" />
								</div>
								<div className="flex flex-col gap-1">
									<span className="body-md text-sub-text-primary">{truncateAddress(user.walletAddress)}</span>
									<span className="body-sm text-sub-text-muted">Wallet Address</span>
								</div>
							</div>
						)}
					</>
				)}

				{isEmailUnverified ? (
					<InlineStatus variant="warning">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<span>Your email isn&apos;t verified.</span>
							<Button type="button" size="md" onClick={handleVerifyEmail}>
								Verify email
							</Button>
						</div>
					</InlineStatus>
				) : null}
			</div>

			<PasswordResetModal
				isOpen={isPasswordModalOpen}
				onClose={() => setIsPasswordModalOpen(false)}
				email={user?.email ?? ''}
				sent={isPasswordResetSent}
				onSend={handleSendPasswordReset}
				isPending={resetPasswordMutation.isPending}
				cooldownMessage={passwordCooldownMsg}
			/>

			<EmailChangeModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />

			<SwitchToEmailModal
				isOpen={isSwitchToEmailModalOpen}
				onClose={() => setIsSwitchToEmailModalOpen(false)}
				defaultEmail={user?.ethereum_email}
			/>
		</>
	)
}
