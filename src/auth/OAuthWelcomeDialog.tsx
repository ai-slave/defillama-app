import * as Ariakit from '@ariakit/react'
import { useId, useState } from 'react'
import { AuthDialogHeader } from '~/auth/AuthDialog'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Dialog, DialogBody } from '~/ui/Dialog'
import { showFieldErrors } from '~/ui/focus'
import { InlineStatus } from '~/ui/Status'

export function OAuthWelcomeDialog({
	isSaving,
	onContinue,
	onSignOut
}: {
	isSaving: boolean
	onContinue: (promotionalEmails: 'on' | 'off', onError: (error: Error) => void) => void
	onSignOut: () => void
}) {
	const [acceptedTerms, setAcceptedTerms] = useState(false)
	const [promotionalEmails, setPromotionalEmails] = useState(true)
	const [submitted, setSubmitted] = useState(false)
	// Not the mutation's own error: that one clears when a retry starts. Success closes the dialog.
	const [error, setError] = useState<string | null>(null)
	const termsErrorId = useId()
	const termsError = submitted && !acceptedTerms ? 'Accept the Terms of Service and Privacy Policy to continue.' : null

	return (
		<Dialog size="sm" open portal unmountOnHide hideOnEscape={false} hideOnInteractOutside={false}>
			<AuthDialogHeader title="Thanks for signing up!" closable={false} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">
					Your account has been created.
				</Ariakit.DialogDescription>
				<form
					noValidate
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault()
						if (!acceptedTerms) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
						onContinue(promotionalEmails ? 'on' : 'off', (failure) => setError(failure.message))
					}}
				>
					<div data-invalid={termsError ? '' : undefined} className="flex flex-col gap-1">
						<Checkbox
							variant="consent"
							disabled={isSaving}
							checked={acceptedTerms}
							onChange={(e) => setAcceptedTerms(e.target.checked)}
							aria-invalid={termsError ? true : undefined}
							aria-describedby={termsError ? termsErrorId : undefined}
						>
							<span>
								I agree to the{' '}
								<BasicLink href="/terms" target="_blank" className="text-link underline">
									Terms of Service
								</BasicLink>{' '}
								and{' '}
								<BasicLink href="/privacy-policy" target="_blank" className="text-link underline">
									Privacy Policy
								</BasicLink>
							</span>
						</Checkbox>
						{termsError ? (
							<p id={termsErrorId} className="body-sm text-error">
								{termsError}
							</p>
						) : null}
					</div>

					<Checkbox
						variant="consent"
						disabled={isSaving}
						checked={promotionalEmails}
						onChange={(e) => setPromotionalEmails(e.target.checked)}
					>
						Receive emails about upcoming DefiLlama products and new releases
					</Checkbox>

					<Button
						type="submit"
						variant="primary"
						size="md"
						className="w-full"
						pendingLabel={isSaving ? 'Saving…' : null}
					>
						Continue
					</Button>
					{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
				</form>
				<p className="text-center body-sm">
					<Button variant="link" onClick={onSignOut}>
						Sign out
					</Button>
				</p>
			</DialogBody>
		</Dialog>
	)
}
