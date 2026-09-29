import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { AuthDialogHeader } from '~/auth/AuthDialog'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody } from '~/ui/Dialog'
import { InlineStatus } from '~/ui/Status'

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
		<Dialog size="sm" open={isOpen} portal unmountOnHide hideOnEscape={false} hideOnInteractOutside={false}>
			<AuthDialogHeader title="Thanks for signing up!" closable={false} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					Your account has been created.
				</Ariakit.DialogDescription>
				<label className="flex items-start gap-2">
					<input
						type="checkbox"
						disabled={isSaving}
						className="mt-0.5 size-4 shrink-0 rounded-sm accent-brand"
						checked={acceptedTerms}
						onChange={(e) => setAcceptedTerms(e.target.checked)}
					/>
					<span className="body-sm text-secondary">
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
					<span className="body-sm text-secondary">
						Receive emails about upcoming DefiLlama products and new releases
					</span>
				</label>

				<Button
					type="button"
					variant="primary"
					size="md"
					className="w-full"
					disabled={!acceptedTerms}
					pendingLabel={isSaving ? 'Saving…' : null}
					onClick={() => onContinue(promotionalEmails ? 'on' : 'off')}
				>
					Continue
				</Button>
				{/* Continue stays disabled until the terms are accepted; this says why. */}
				{acceptedTerms ? null : (
					<p className="body-sm text-tertiary">Accept the Terms of Service and Privacy Policy to continue.</p>
				)}
				{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
				<button type="button" className="body-sm text-link" onClick={onSignOut}>
					Sign out
				</button>
			</DialogBody>
		</Dialog>
	)
}
