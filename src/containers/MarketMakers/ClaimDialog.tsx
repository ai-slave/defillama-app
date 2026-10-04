import * as Ariakit from '@ariakit/react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { TokenLogo } from '~/components/TokenLogo'
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
import { Input, inputStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'
import { ClaimTurnstile, isClaimTurnstileEnabled } from './ClaimTurnstile'
import { useSubmitLead } from './client'
import { LeadField, LeadHoneypot, LeadSuccess } from './LeadForm'
import { EMAIL_PATTERN, normalizeSocialUrl, SOCIAL_PROFILE_PATTERN } from './leadShared'

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
	const dialogRef = useRef<HTMLDivElement>(null)
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
	const [touched, setTouched] = useState<Record<string, boolean>>({})
	const [submitAttempted, setSubmitAttempted] = useState(false)
	const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
	const captchaEnabled = isClaimTurnstileEnabled()

	const errors: Record<string, string | null> = {
		position: position.trim() === '' ? 'Position is required' : null,
		contactName: hasContact === 'yes' && contactName.trim() === '' ? 'Enter the Forgd team member name' : null,
		fullName: fullName.trim() === '' ? 'Full name is required' : null,
		socialProfileUrl: !SOCIAL_PROFILE_PATTERN.test(socialProfileUrl.trim()) ? 'Enter a valid LinkedIn or X URL' : null,
		organizationEmail:
			organizationEmail.trim() === ''
				? 'Organization email is required'
				: !EMAIL_PATTERN.test(organizationEmail.trim())
					? 'Enter a valid email address'
					: null,
		consents: !alignmentConsent || !termsConsent ? 'Both consents are required to submit' : null,
		// Validated like a field, so Submit never sits disabled without saying why.
		captcha: captchaEnabled && turnstileToken === '' ? 'Complete the verification check to submit' : null
	}
	const isValid = Object.values(errors).every((error) => error == null)
	const showError = (key: string) => (submitAttempted || touched[key] ? errors[key] : null)
	const markTouched = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }))

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

	const onSubmit = () => {
		if (!isValid) {
			// The errors appear above, away from Submit, so focus moves to the first field that needs fixing.
			flushSync(() => setSubmitAttempted(true))
			dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
			return
		}
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
		<Dialog ref={dialogRef} size="md" open={open} onClose={onClose} pending={submit.isPending} portal unmountOnHide>
			{submit.isSuccess ? (
				<LeadSuccess
					title="Claim request received"
					message="The Forgd team will review your claim and reach out with next steps using the contact details you provided."
				/>
			) : (
				<>
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
							<div className="flex flex-col gap-1.5">
								<span className="label-sm text-primary">Name of organization</span>
								<div className={`${inputStyles} flex items-center gap-2`} aria-readonly>
									<TokenLogo src={marketMakerLogo ?? null} size={18} />
									<span className="truncate">{marketMakerName}</span>
								</div>
							</div>
							<LeadField label="Position at organization" error={showError('position')}>
								{/* The form's first field: the organization above is fixed. */}
								<Ariakit.Focusable
									autoFocus
									render={
										<Input
											value={position}
											onChange={(e) => setPosition(e.target.value)}
											onBlur={markTouched('position')}
											aria-invalid={showError('position') != null}
											maxLength={200}
											placeholder="e.g. CEO"
										/>
									}
								/>
							</LeadField>
						</div>
						<div className="flex flex-col gap-1.5">
							<span className="label-sm text-primary">Do you have direct contact with a Forgd team member?</span>
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
							<LeadField label="Forgd team member name" error={showError('contactName')}>
								<Input
									value={contactName}
									onChange={(e) => setContactName(e.target.value)}
									onBlur={markTouched('contactName')}
									aria-invalid={showError('contactName') != null}
									maxLength={200}
									placeholder="Name the person you know"
								/>
							</LeadField>
						) : null}
						<LeadField label="Your full name" error={showError('fullName')}>
							<Input
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								onBlur={markTouched('fullName')}
								aria-invalid={showError('fullName') != null}
								maxLength={200}
								placeholder="Your name"
							/>
						</LeadField>
						<LeadField label="Your LinkedIn or X profile" error={showError('socialProfileUrl')}>
							<Input
								value={socialProfileUrl}
								onChange={(e) => setSocialProfileUrl(e.target.value)}
								onBlur={markTouched('socialProfileUrl')}
								aria-invalid={showError('socialProfileUrl') != null}
								maxLength={500}
								placeholder="Enter a valid LinkedIn or X URL"
							/>
						</LeadField>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<LeadField label="Your organization email address" error={showError('organizationEmail')}>
								<Input
									type="email"
									value={organizationEmail}
									onChange={(e) => setOrganizationEmail(e.target.value)}
									onBlur={markTouched('organizationEmail')}
									aria-invalid={showError('organizationEmail') != null}
									maxLength={320}
									placeholder="you@organization.com"
								/>
							</LeadField>
							<LeadField label="Telegram handle (optional)">
								<Input
									value={telegram}
									onChange={(e) => setTelegram(e.target.value)}
									maxLength={64}
									placeholder="@handle"
								/>
							</LeadField>
						</div>
						<div className="flex flex-col gap-1 border-t border-subtle pt-4">
							<Checkbox
								variant="consent"
								aria-invalid={showError('consents') != null && !alignmentConsent}
								checked={alignmentConsent}
								onChange={(e) => setAlignmentConsent(e.target.checked)}
							>
								I agree to verify my alignment with the organization to confirm the claim.
							</Checkbox>
							<Checkbox
								variant="consent"
								aria-invalid={showError('consents') != null && !termsConsent}
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
							{showError('consents') ? <span className="body-sm text-error">{showError('consents')}</span> : null}
						</div>
						<LeadHoneypot value={honeypot} onChange={setHoneypot} />
						{captchaEnabled ? (
							<div className="flex flex-col items-center gap-1.5">
								<ClaimTurnstile ref={turnstileRef} onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} />
								{showError('captcha') ? (
									<span role="alert" className="body-sm text-error">
										{showError('captcha')}
									</span>
								) : null}
							</div>
						) : null}
						{failure ? <InlineStatus variant="error">{failure}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button
							type="button"
							variant="primary"
							size="md"
							pendingLabel={submit.isPending ? 'Submitting…' : null}
							onClick={onSubmit}
						>
							Submit claim request
						</Button>
					</DialogFooter>
				</>
			)}
		</Dialog>
	)
}
