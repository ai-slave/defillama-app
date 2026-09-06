import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useEffect, useRef, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Input, inputStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { ClaimTurnstile, isClaimTurnstileEnabled } from './ClaimTurnstile'
import { requestLeadClickId, useSubmitLead } from './client'
import {
	LeadCancelButton,
	LeadDialog,
	LeadDialogBody,
	LeadDialogFooter,
	LeadDialogHeader,
	LeadError,
	LeadField,
	LeadHoneypot,
	LeadSuccess
} from './LeadDialog'
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
}) {
	// The form is a child of the dialog, which Ariakit unmounts when it closes, so every open starts from a
	// fresh form, mutation and captcha instead of resetting a dozen fields by hand.
	return (
		<LeadDialog open={open} onClose={onClose}>
			<ClaimDialogForm onClose={onClose} {...form} />
		</LeadDialog>
	)
}

function ClaimDialogForm({
	onClose,
	marketMakerId,
	marketMakerName,
	marketMakerLogo
}: {
	onClose: () => void
	marketMakerId: string | null
	marketMakerName: string
	marketMakerLogo?: string | null
}) {
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
	const clickIdRef = useRef<string | null>(null)
	const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
	const submit = useSubmitLead('claim')
	const captchaEnabled = isClaimTurnstileEnabled()

	// One click id per opened form; the ref is only read when the form is submitted.
	useEffect(() => {
		let superseded = false
		requestLeadClickId('claim', marketMakerId).then((clickId) => {
			if (!superseded) clickIdRef.current = clickId
		})
		return () => {
			superseded = true
		}
	}, [marketMakerId])

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
		consents: !alignmentConsent || !termsConsent ? 'Both consents are required to submit' : null
	}
	const isValid = Object.values(errors).every((error) => error == null)
	const showError = (key: string) => (submitAttempted || touched[key] ? errors[key] : null)
	const markTouched = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }))

	const onSubmit = () => {
		if (submit.isPending) return
		if (!isValid) {
			setSubmitAttempted(true)
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
				click_id: clickIdRef.current,
				source_url: typeof window === 'undefined' ? null : window.location.href,
				hp: honeypot,
				turnstile_token: turnstileToken
			},
			{
				onError: () => {
					setTurnstileToken('')
					turnstileRef.current?.reset()
				}
			}
		)
	}

	return (
		<>
			<LeadDialogHeader title={`Claim ${marketMakerName} on Forgd`} hidden={submit.isSuccess} />
			<LeadDialogBody>
				{submit.isSuccess ? (
					<LeadSuccess
						title="Claim request received"
						message="The Forgd team will review the details of your claim, and will reach out via the provided contact information shortly with next steps."
						onClose={onClose}
					/>
				) : (
					<>
						<p className="body-sm text-secondary">
							Submit your request to start the claiming process. The Forgd team will assess the legitimacy of the claim
							and proceed with your access.
						</p>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="flex flex-col gap-1.5">
								<span className="label-md text-primary">Name of Organization</span>
								<div className={`${inputStyles} flex items-center gap-2`} aria-readonly>
									<TokenLogo src={marketMakerLogo ?? null} size={18} />
									<span className="truncate">{marketMakerName}</span>
								</div>
							</div>
							<LeadField label="Position at Organization" error={showError('position')}>
								<Input
									value={position}
									onChange={(e) => setPosition(e.target.value)}
									onBlur={markTouched('position')}
									maxLength={200}
									placeholder="e.g. CEO"
								/>
							</LeadField>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-elevated-1 px-3 py-2">
							<span className="label-md text-primary">Do you have direct contact with a Forgd team member?</span>
							<SegmentedControl
								value={hasContact}
								onValueChange={(value) => setHasContact(value)}
								options={CONTACT_OPTIONS}
								label="Forgd contact"
								variant="default"
								size="sm"
								className="w-fit"
							/>
						</div>
						{hasContact === 'yes' ? (
							<LeadField label="Forgd team member name" error={showError('contactName')}>
								<Input
									value={contactName}
									onChange={(e) => setContactName(e.target.value)}
									onBlur={markTouched('contactName')}
									maxLength={200}
									placeholder="Name the person you know"
								/>
							</LeadField>
						) : null}
						<LeadField label="Your Full Name" error={showError('fullName')}>
							<Input
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								onBlur={markTouched('fullName')}
								maxLength={200}
								placeholder="Your name"
							/>
						</LeadField>
						<LeadField label="Your LinkedIn or X profile" error={showError('socialProfileUrl')}>
							<Input
								value={socialProfileUrl}
								onChange={(e) => setSocialProfileUrl(e.target.value)}
								onBlur={markTouched('socialProfileUrl')}
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
								variant="inline"
								checked={alignmentConsent}
								onChange={(e) => setAlignmentConsent(e.target.checked)}
							>
								I agree to verify my alignment with the organization to confirm the claim.
							</Checkbox>
							<Checkbox variant="inline" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)}>
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
							<ClaimTurnstile
								ref={turnstileRef}
								onVerify={setTurnstileToken}
								onError={() => setTurnstileToken('')}
								className="mx-auto w-full max-w-md"
							/>
						) : null}
						{submit.isError ? (
							<LeadError
								message={submit.error instanceof Error ? submit.error.message : 'Failed to submit the claim request'}
							/>
						) : null}
					</>
				)}
			</LeadDialogBody>
			{submit.isSuccess ? null : (
				<LeadDialogFooter>
					<LeadCancelButton />
					<Button
						type="button"
						variant="primary"
						size="md"
						disabled={submit.isPending || (captchaEnabled && turnstileToken === '')}
						onClick={onSubmit}
					>
						{submit.isPending ? 'Submitting…' : 'Submit Claim Request'}
					</Button>
				</LeadDialogFooter>
			)}
		</>
	)
}
