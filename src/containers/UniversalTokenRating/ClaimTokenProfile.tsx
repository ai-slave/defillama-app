import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useRef, useState, type ReactNode } from 'react'
import { ClaimTurnstile, isClaimTurnstileEnabled } from '~/containers/MarketMakers/ClaimTurnstile'
import { useSubmitLead } from '~/containers/MarketMakers/client'
import { LeadError } from '~/containers/MarketMakers/LeadDialog'
import { EMAIL_PATTERN, SOCIAL_PROFILE_PATTERN } from '~/containers/MarketMakers/leadShared'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'
import { buildUtrClaimRequest } from './claimRequest'
import type { UtrClaimProjectOption, UtrScoringConfig } from './types'

const CONTACT_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'no', label: 'No' }
] as const

function LabeledField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="label-md text-primary">{label}</span>
			{children}
			{error ? <span className="body-sm text-error">{error}</span> : null}
		</div>
	)
}

function ClaimConfirmation() {
	return (
		<Card padding="md" className="mx-auto flex w-full max-w-3xl flex-col gap-5">
			<span className="flex size-16 items-center justify-center rounded-full border-2 border-success">
				<Icon name="check" height={28} width={28} className="text-success" />
			</span>
			<h2 className="heading-lg">Request received</h2>
			<p className="body-lg text-secondary">
				Our team will review the details of your request, and will reach out via the provided contact information
				shortly with next steps.
			</p>
			<h3 className="heading-sm">What is next?</h3>
			<ol className="flex list-decimal flex-col gap-3 pl-6 body-lg text-secondary">
				<li>If your information is verified, your token will appear as claimed</li>
				<li>The Forgd team will provide access to manage your token profile and disclosures</li>
				<li>Verified profile updates will be reflected in the Universal Token Rating after they have been reviewed.</li>
			</ol>
		</Card>
	)
}

export function ClaimTokenProfile({
	variant = 'claim',
	projects = []
}: {
	variant?: 'claim' | 'join'
	projects?: UtrClaimProjectOption[]
	exchangeOptions?: string[]
	scoringConfig?: UtrScoringConfig | null
}) {
	const [token, setToken] = useState<string>(variant === 'claim' ? (projects[0]?.arcticId ?? '') : '')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [position, setPosition] = useState('')
	const [hasContact, setHasContact] = useState<'yes' | 'no'>('no')
	const [contactName, setContactName] = useState('')
	const [profileUrl, setProfileUrl] = useState('')
	const [email, setEmail] = useState('')
	const [telegram, setTelegram] = useState('')
	const [alignmentConsent, setAlignmentConsent] = useState(false)
	const [termsConsent, setTermsConsent] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState('')
	const [submitAttempted, setSubmitAttempted] = useState(false)
	const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
	const submit = useSubmitLead('claim')
	const captchaEnabled = isClaimTurnstileEnabled()

	const errors: Record<string, string | null> = {
		token:
			token.trim() === '' ? (variant === 'claim' ? 'Select the token to claim' : 'Project name is required') : null,
		firstName: firstName.trim() === '' ? 'First name is required' : null,
		lastName: lastName.trim() === '' ? 'Last name is required' : null,
		position: position.trim() === '' ? 'Position is required' : null,
		contactName: hasContact === 'yes' && contactName.trim() === '' ? 'Enter the Forgd team member name' : null,
		email:
			email.trim() === ''
				? 'Organization email is required'
				: !EMAIL_PATTERN.test(email.trim())
					? 'Enter a valid email address'
					: null,
		profileUrl: !SOCIAL_PROFILE_PATTERN.test(profileUrl.trim()) ? 'Enter a valid LinkedIn or X URL' : null,
		consents: !alignmentConsent || !termsConsent ? 'Both consents are required to submit' : null,
		captcha: captchaEnabled && turnstileToken === '' ? 'Complete the CAPTCHA verification' : null
	}
	const isValid = Object.values(errors).every((error) => error == null)
	const showError = (key: string) => (submitAttempted ? errors[key] : null)
	const selectedProject = variant === 'claim' ? (projects.find((project) => project.arcticId === token) ?? null) : null
	const selectedProjectStatus = selectedProject
		? [
				selectedProject.tgeStatus === 'post' ? 'Listed' : 'Pre-TGE',
				selectedProject.criteriaCount
					? `${selectedProject.gradedCount}/${selectedProject.criteriaCount} criteria scored`
					: 'Not scored',
				selectedProject.disclosureScore == null
					? null
					: `Disclosure ${formatNumber(selectedProject.disclosureScore, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
							useGrouping: false
						})}/10`
			]
				.filter(Boolean)
				.join(' · ')
		: null

	const onSubmit = () => {
		if (submit.isPending) return
		if (!isValid) {
			setSubmitAttempted(true)
			return
		}
		const projectName = selectedProject?.projectName ?? token
		submit.mutate(
			buildUtrClaimRequest({
				projectName,
				position,
				hasForgdContact: hasContact === 'yes',
				forgdContactName: contactName,
				firstName,
				lastName,
				profileUrl,
				email,
				telegram,
				alignmentConsent,
				termsConsent,
				sourceUrl: typeof window === 'undefined' ? null : window.location.href,
				turnstileToken
			}),
			{
				onSuccess: () => window.scrollTo({ top: 0 }),
				onError: () => {
					setTurnstileToken('')
					turnstileRef.current?.reset()
				}
			}
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-1 pt-4 text-center">
				<h1 className="text-xl">
					{variant === 'claim' ? (
						<>
							<strong className="font-bold">Universal Token Rating</strong> - Claim Your Token Profile
						</>
					) : (
						<strong className="font-bold">Apply for the Universal Token Rating</strong>
					)}
				</h1>
				<p className="body-sm text-tertiary">Submit your affiliation details for verification. Powered by Forgd</p>
			</div>

			{submit.isSuccess ? (
				<ClaimConfirmation />
			) : (
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
					<Card padding="md" className="flex flex-col gap-4">
						<div className="flex flex-col gap-1 border-b border-subtle pb-3">
							<h2 className="heading-sm">Verify Your Affiliation</h2>
							<p className="body-sm text-secondary">
								Tell us who you are and how you are affiliated with the project. We may contact you to verify your
								claim.
							</p>
						</div>
						{variant === 'claim' ? (
							<LabeledField label="Token to claim" error={showError('token')}>
								<span className="flex flex-wrap items-center gap-2">
									<select
										className={`${inputStyles} min-w-64 flex-1 cursor-pointer`}
										value={token}
										disabled={!projects.length}
										onChange={(e) => setToken(e.target.value)}
									>
										{projects.length ? null : <option value="">Token list unavailable</option>}
										{projects.map((project) => (
											<option key={project.arcticId} value={project.arcticId}>
												{project.projectName} ({project.symbol})
											</option>
										))}
									</select>
									<span className="rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 mono-sm text-secondary">
										{selectedProjectStatus ?? 'Token list unavailable'}
									</span>
								</span>
							</LabeledField>
						) : (
							<LabeledField label="Project name" error={showError('token')}>
								<Input value={token} onChange={(e) => setToken(e.target.value)} maxLength={200} />
							</LabeledField>
						)}
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<LabeledField label="First Name" error={showError('firstName')}>
								<Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={200} />
							</LabeledField>
							<LabeledField label="Last Name" error={showError('lastName')}>
								<Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={200} />
							</LabeledField>
							<LabeledField label="Position at organization" error={showError('position')}>
								<Input
									value={position}
									onChange={(e) => setPosition(e.target.value)}
									maxLength={200}
									placeholder="E.g., CEO"
								/>
							</LabeledField>
							<LabeledField label="Your LinkedIn or X profile" error={showError('profileUrl')}>
								<Input
									value={profileUrl}
									onChange={(e) => setProfileUrl(e.target.value)}
									maxLength={500}
									placeholder="Enter a valid LinkedIn or X URL"
								/>
							</LabeledField>
							<LabeledField label="Your organization email address" error={showError('email')}>
								<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} />
							</LabeledField>
							<LabeledField label="Telegram handle (optional)">
								<Input value={telegram} onChange={(e) => setTelegram(e.target.value)} maxLength={64} />
							</LabeledField>
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
							<LabeledField label="Forgd team member name" error={showError('contactName')}>
								<Input
									value={contactName}
									onChange={(e) => setContactName(e.target.value)}
									maxLength={200}
									placeholder="Name the person you know"
								/>
							</LabeledField>
						) : null}
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
						{captchaEnabled ? (
							<div className="flex flex-col items-center gap-1.5">
								<ClaimTurnstile
									ref={turnstileRef}
									onVerify={setTurnstileToken}
									onError={() => setTurnstileToken('')}
									className="w-full max-w-md"
								/>
								{showError('captcha') ? <span className="body-sm text-error">{showError('captcha')}</span> : null}
							</div>
						) : null}
					</Card>

					{submit.isError ? (
						<LeadError
							message={submit.error instanceof Error ? submit.error.message : 'Failed to submit the claim request'}
						/>
					) : null}
					<Button
						type="button"
						variant="primary"
						size="md"
						className="w-full justify-center"
						disabled={submit.isPending || (captchaEnabled && turnstileToken === '')}
						onClick={onSubmit}
					>
						{submit.isPending ? 'Submitting…' : variant === 'claim' ? 'Submit Claim Request' : 'Submit Application'}
						<Icon name="arrow-up-right" height={14} width={14} />
					</Button>
				</div>
			)}
		</div>
	)
}
