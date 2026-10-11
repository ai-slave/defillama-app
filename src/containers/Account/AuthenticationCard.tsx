import { useState } from 'react'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { EmailChangeModal } from './EmailChangeModal'
import { PasswordResetModal } from './PasswordResetModal'
import { SwitchToEmailModal } from './SwitchToEmailModal'
import { isWalletEmail, truncateAddress } from './utils'

export function AuthenticationCard() {
	const { user, promptVerifyEmail } = useAuthContext()

	const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
	const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
	const [isSwitchToEmailModalOpen, setIsSwitchToEmailModalOpen] = useState(false)
	// When the last reset link went out; the dialog's wait runs from it across openings.
	const [passwordResetSentAt, setPasswordResetSentAt] = useState<number | null>(null)

	const walletEmail = isWalletEmail(user?.email)
	const isEmailUnverified = !walletEmail && user?.verified === false
	const walletAddress = user?.walletAddress
	const walletDisplayName = walletAddress ? truncateAddress(walletAddress) : ''

	const handleChangeEmail = () => {
		setIsEmailModalOpen(true)
	}

	const handleVerifyEmail = () => {
		if (!user?.email) return
		promptVerifyEmail(user.id)
	}

	return (
		<>
			<Card padding="md" className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<Icon name="key" className="size-7 text-primary" />
					<span className="label-lg text-primary">Authentication</span>
				</div>

				<p className="body-sm text-tertiary">Manage your authentication methods.</p>

				{walletEmail ? (
					<>
						<div className="flex items-center gap-3">
							<div className="flex items-center rounded-full bg-surface-elevated-1 p-2">
								<Icon name="wallet" className="size-5 text-primary" />
							</div>
							<div className="flex flex-col gap-1">
								<span className="body-md text-primary">{walletDisplayName}</span>
								<span className="body-sm text-tertiary">Wallet address</span>
							</div>
						</div>

						<div className="flex flex-col gap-1">
							<div className="flex items-center justify-between gap-3">
								<div className="flex flex-col gap-1">
									<span className="body-md text-primary">Email &amp; Password</span>
									<span className="body-sm text-tertiary">Not set up</span>
								</div>
								<Button type="button" size="md" onClick={() => setIsSwitchToEmailModalOpen(true)}>
									Add email sign-in
								</Button>
							</div>
							<p className="body-sm text-tertiary">Add an email and password as another way to sign in.</p>
						</div>
					</>
				) : (
					<>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<div className="flex items-center rounded-full bg-surface-elevated-1 p-2">
									<Icon name="mail" className="size-5 text-primary" />
								</div>
								<div className="flex flex-col gap-1">
									<span className="body-md text-primary">{user?.email}</span>
									<span className="body-sm text-tertiary">Email & Password</span>
								</div>
							</div>
							<div className="flex gap-2">
								<Button type="button" size="md" onClick={handleChangeEmail}>
									Change email
								</Button>
								<Button type="button" size="md" onClick={() => setIsPasswordModalOpen(true)}>
									Change password
								</Button>
							</div>
						</div>

						{user?.walletAddress && (
							<div className="flex items-center gap-3">
								<div className="flex items-center rounded-full bg-surface-elevated-1 p-2">
									<Icon name="wallet" className="size-5 text-primary" />
								</div>
								<div className="flex flex-col gap-1">
									<span className="body-md text-primary">{truncateAddress(user.walletAddress)}</span>
									<span className="body-sm text-tertiary">Wallet address</span>
								</div>
							</div>
						)}
					</>
				)}

				{isEmailUnverified ? (
					<InlineStatus
						variant="warning"
						action={
							<Button type="button" size="sm" onClick={handleVerifyEmail}>
								Verify email
							</Button>
						}
					>
						Your email isn&apos;t verified.
					</InlineStatus>
				) : null}
			</Card>

			<PasswordResetModal
				isOpen={isPasswordModalOpen}
				onClose={() => setIsPasswordModalOpen(false)}
				email={user?.email ?? ''}
				sentAtSeconds={passwordResetSentAt}
				onSent={setPasswordResetSentAt}
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
