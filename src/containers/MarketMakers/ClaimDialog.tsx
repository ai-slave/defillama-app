import * as Ariakit from '@ariakit/react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useId, useRef, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'
import { emailError } from '~/utils/email'
import { ClaimTurnstile, isClaimTurnstileEnabled } from './ClaimTurnstile'
import { useSubmitLead } from './client'
import { LeadHoneypot, LeadSuccess } from './LeadForm'
import { normalizeSocialUrl, SOCIAL_PROFILE_PATTERN } from './leadShared'

const CONTACT_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'no', label: 'No' }
] as const

export function ClaimDialog({
	open,
	onClose,
	...form
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	marketMakerName: string
	marketMakerLogo?: string | null
	/** Recorded by the click that opened this form; null until that request answers, or if it failed. */
	clickId: string | null
}) {
	// One form per opening: a new opening starts a new request, and the dialog locks while one runs.
	const key = useOpeningKey(open)
	return <ClaimForm key={key} open={open} onClose={onClose} {...form} />
}

function ClaimForm({
	open,
	onClose,
	marketMakerId,
	marketMakerName,
	marketMakerLogo,
	clickId
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	marketMakerName: string
	marketMakerLogo?: string | null
	clickId: string | null
}) {
	const submit = useSubmitLead('claim')
	// The last failure, kept while a retry runs: the mutation clears its own error when the retry starts.
	const [failure, setFailure] = useState<string | null>(null)
	const consentsErrorId = `${useId()}-error`
	const awaitingCheckId = useId()
	const [position, setPosition] = useState('')
	const [hasContact, setHasContact] = useState<'yes' | 'no'>('no')
	const [contactName, setContactName] = useState('')
	const [fullName, setFullName] = useState('')
	const [socialProfileUrl, setSocialProfileUrl] = useState('')
	const [organizationEmail, setOrganizationEmail] = useState('')
	const [telegram, setTelegram] = useState('')
	const [alignmentConsent, setAlignmentConsent] = useState(false)
	const [termsConsent, setTermsConsent] = useState(false)
	const [honeypot, setHoneypot] = useState('')
	const [turnstileToken, setTurnstileToken] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
	const captchaEnabled = isClaimTurnstileEnabled()

	const errors = {
		position: position.trim() === '' ? 'Enter your position at the organization.' : null,
		contactName: hasContact === 'yes' && contactName.trim() === '' ? 'Enter the Forgd team member’s name.' : null,
		fullName: fullName.trim() === '' ? 'Enter your full name.' : null,
		socialProfileUrl:
			socialProfileUrl.trim() === ''
				? 'Enter your LinkedIn or X profile URL.'
				: SOCIAL_PROFILE_PATTERN.test(socialProfileUrl.trim())
					? null
					: 'Enter a valid LinkedIn or X URL.',
		organizationEmail: emailError(organizationEmail),
		consents: !alignmentConsent || !termsConsent ? 'Agree to both statements to submit the claim.' : null
	}
	const consentsError = submitted ? errors.consents : null
	// The security check is a gate, not a field: Submit waits for its token and says so beside it, since a blocked
	// widget shows nothing.
	const awaitingCheck = captchaEnabled && turnstileToken === ''

	const dirty =
		position !== '' ||
		hasContact !== 'no' ||
		contactName !== '' ||
		fullName !== '' ||
		socialProfileUrl !== '' ||
		organizationEmail !== '' ||
		telegram !== '' ||
		alignmentConsent ||
		termsConsent

	const onSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (submit.isPending || awaitingCheck) return
		if (Object.values(errors).some(Boolean)) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		submit.mutate(
			{
				position,
				has_forgd_contact: hasContact === 'yes',
				forgd_contact_name: hasContact === 'yes' ? contactName : null,
				full_name: fullName,
				social_profile_url: normalizeSocialUrl(socialProfileUrl.trim()),
				organization_email: organizationEmail.trim(),
				telegram: telegram || null,
				alignment_consent: alignmentConsent,
				terms_consent: termsConsent,
				market_maker_id: marketMakerId,
				market_maker_name: marketMakerName,
				click_id: clickId,
				source_url: typeof window === 'undefined' ? null : window.location.href,
				hp: honeypot,
				turnstile_token: turnstileToken
			},
			{
				onError: (error) => {
					setFailure(error.message)
					setTurnstileToken('')
					turnstileRef.current?.reset()
				}
			}
		)
	}

	return (
		<Dialog size="md" open={open} onClose={onClose} pending={submit.isPending} portal unmountOnHide>
			{submit.isSuccess ? (
				<LeadSuccess
					title="Claim request received"
					message="The Forgd team will review your claim and reach out with next steps using the contact details you provided."
				/>
			) : (
				<form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-auto flex-col">
					<DialogDiscardGuard
						when={dirty}
						title="Discard this claim request?"
						description="The details you entered are lost."
					/>
					<DialogHeader title={`Claim ${marketMakerName} on Forgd`} />
					<DialogBody>
						<p className="body-sm text-secondary">
							Submit your request to start the claiming process. The Forgd team will assess the legitimacy of the claim
							and proceed with your access.
						</p>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Field label="Name of organization">
								{(control) => (
									<Input
										{...control}
										readOnly
										value={marketMakerName}
										prefix={<TokenLogo src={marketMakerLogo ?? null} size={18} />}
									/>
								)}
							</Field>
							<Field label="Position at organization" error={submitted ? errors.position : null}>
								{(control) => (
									// The form's first field: the organization beside it is fixed.
									<Ariakit.Focusable
										autoFocus
										render={
											<Input
												{...control}
												value={position}
												onChange={(e) => setPosition(e.target.value)}
												maxLength={200}
												placeholder="e.g. CEO"
											/>
										}
									/>
								)}
							</Field>
						</div>
						<div className="flex flex-col gap-1">
							<span className="label-sm text-secondary">Do you have direct contact with a Forgd team member?</span>
							<SegmentedControl
								value={hasContact}
								onValueChange={(value) => setHasContact(value)}
								options={CONTACT_OPTIONS}
								label="Forgd contact"
								variant="default"
								size="md"
							/>
						</div>
						{hasContact === 'yes' ? (
							<Field label="Forgd team member name" error={submitted ? errors.contactName : null}>
								{(control) => (
									<Input
										{...control}
										value={contactName}
										onChange={(e) => setContactName(e.target.value)}
										maxLength={200}
										placeholder="Name the person you know"
									/>
								)}
							</Field>
						) : null}
						<Field label="Your full name" error={submitted ? errors.fullName : null}>
							{(control) => (
								<Input
									{...control}
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									maxLength={200}
									placeholder="Your name"
								/>
							)}
						</Field>
						<Field label="Your LinkedIn or X profile" error={submitted ? errors.socialProfileUrl : null}>
							{(control) => (
								<Input
									{...control}
									value={socialProfileUrl}
									onChange={(e) => setSocialProfileUrl(e.target.value)}
									maxLength={500}
									placeholder="Enter a valid LinkedIn or X URL"
								/>
							)}
						</Field>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Field label="Your organization email address" error={submitted ? errors.organizationEmail : null}>
								{(control) => (
									<Input
										{...control}
										type="email"
										required
										value={organizationEmail}
										onChange={(e) => setOrganizationEmail(e.target.value)}
										maxLength={320}
										placeholder="you@organization.com"
									/>
								)}
							</Field>
							<Field label="Telegram handle (optional)">
								{(control) => (
									<Input
										{...control}
										value={telegram}
										onChange={(e) => setTelegram(e.target.value)}
										maxLength={64}
										placeholder="@handle"
									/>
								)}
							</Field>
						</div>
						{/* Two required consents share one error: each unticked box is marked, and focus lands on the first. */}
						<div
							data-invalid={consentsError ? '' : undefined}
							className="flex flex-col gap-1 border-t border-subtle pt-4"
						>
							<Checkbox
								variant="consent"
								aria-invalid={consentsError && !alignmentConsent ? true : undefined}
								aria-describedby={consentsError ? consentsErrorId : undefined}
								checked={alignmentConsent}
								onChange={(e) => setAlignmentConsent(e.target.checked)}
							>
								I agree to verify my alignment with the organization to confirm the claim.
							</Checkbox>
							<Checkbox
								variant="consent"
								aria-invalid={consentsError && !termsConsent ? true : undefined}
								aria-describedby={consentsError ? consentsErrorId : undefined}
								checked={termsConsent}
								onChange={(e) => setTermsConsent(e.target.checked)}
							>
								<span>
									I understand and agree to the Forgd{' '}
									<a
										href="https://www.forgd.com/terms-conditions"
										target="_blank"
										rel="noreferrer noopener"
										className="text-link hover:underline"
									>
										Terms & Conditions
									</a>{' '}
									and{' '}
									<a
										href="https://www.forgd.com/privacy-policy"
										target="_blank"
										rel="noreferrer noopener"
										className="text-link hover:underline"
									>
										Privacy Policy
									</a>
									.
								</span>
							</Checkbox>
							{consentsError ? (
								<p id={consentsErrorId} className="body-sm text-error">
									{consentsError}
								</p>
							) : null}
						</div>
						<LeadHoneypot value={honeypot} onChange={setHoneypot} />
						<ClaimTurnstile ref={turnstileRef} onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} />
						{failure ? <InlineStatus variant="error">{failure}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter
						dismiss={<DialogCancelButton />}
						leading={
							awaitingCheck ? (
								<p id={awaitingCheckId} className="body-sm text-secondary">
									Waiting for the security check above to finish.
								</p>
							) : null
						}
					>
						<Button
							type="submit"
							variant="primary"
							size="md"
							// A failed send spends the token, so the pressed button disables itself and keeps focus.
							disabled={awaitingCheck}
							accessibleWhenDisabled
							aria-describedby={awaitingCheck ? awaitingCheckId : undefined}
							pendingLabel="Submitting…"
							pending={submit.isPending}
						>
							Submit claim request
						</Button>
					</DialogFooter>
				</form>
			)}
		</Dialog>
	)
}
