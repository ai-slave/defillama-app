import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { AuthDialogHeader, authDialogStyles, authBodyStyles, authPrimaryButtonStyles } from '~/auth/AuthDialog'
import { BasicLink } from '~/components/Link'
import { LoadingSpinner } from '~/ui/Loaders'

export function OAuthWelcomeDialog({
	isOpen,
	isSaving = false,
	error = null,
	onContinue,
	onSignOut
}: {
	isOpen: boolean
	isSaving?: boolean
	error?: string | null
	onContinue: (promotionalEmails: 'on' | 'off') => void
	onSignOut: () => void
}) {
	const [acceptedTerms, setAcceptedTerms] = useState(false)
	const [promotionalEmails, setPromotionalEmails] = useState(true)

	return (
		<Ariakit.DialogProvider open={isOpen}>
			<Ariakit.Dialog
				backdrop={<div className="bg-screen-dim" />}
				className={authDialogStyles}
				portal
				unmountOnHide
				hideOnEscape={false}
				hideOnInteractOutside={false}
			>
				<AuthDialogHeader title="Thanks for signing up!" closeable={false} />
				<div className={authBodyStyles}>
					<p className="text-sm text-secondary">Your account has been created.</p>
					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							disabled={isSaving}
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
							checked={acceptedTerms}
							onChange={(e) => setAcceptedTerms(e.target.checked)}
						/>
						<span className="text-xs leading-4 text-tertiary">
							I agree to the{' '}
							<BasicLink href="/terms" target="_blank" className="text-link underline">
								Terms of Service
							</BasicLink>{' '}
							and{' '}
							<BasicLink href="/privacy-policy" target="_blank" className="text-link underline">
								Privacy Policy
							</BasicLink>
						</span>
					</label>

					<label className="flex items-start gap-2">
						<input
							type="checkbox"
							disabled={isSaving}
							className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
							checked={promotionalEmails}
							onChange={(e) => setPromotionalEmails(e.target.checked)}
						/>
						<span className="text-xs leading-4 text-tertiary">
							Receive emails about upcoming DefiLlama products and new releases
						</span>
					</label>

					<button
						type="button"
						disabled={!acceptedTerms || isSaving}
						className={authPrimaryButtonStyles}
						onClick={() => onContinue(promotionalEmails ? 'on' : 'off')}
					>
						{isSaving ? (
							<span className="inline-flex items-center gap-2">
								<LoadingSpinner size={14} />
								Saving...
							</span>
						) : (
							'Continue'
						)}
					</button>
					{error ? (
						<p role="alert" className="text-xs leading-4 text-error">
							{error}
						</p>
					) : null}
					<button type="button" className="text-sm text-link" onClick={onSignOut}>
						Sign out
					</button>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
