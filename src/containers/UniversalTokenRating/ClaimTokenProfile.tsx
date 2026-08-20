import { useState, type ReactNode } from 'react'
import { EMAIL_PATTERN, SOCIAL_PROFILE_PATTERN } from '~/containers/MarketMakers/leadShared'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { CLAIM_BLOCKS, type ClaimColumn, type ClaimTableSection } from './claimFormConfig'
import type { UtrClaimProjectOption } from './types'
import { UtrDocsDrawer } from './UtrDocsDrawer'

const ATTACH_HINT = 'Supported formats: PDF, DOCX, XLSX, TXT, MD – Max file size: 10mb'

function AttachDocuments({ id }: { id: string }) {
	const [files, setFiles] = useState<string[]>([])
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-3">
				<label
					htmlFor={id}
					className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-medium px-3 py-1.5 label-md text-primary hover:bg-hover-row"
				>
					<input
						id={id}
						type="file"
						multiple
						accept=".pdf,.docx,.xlsx,.txt,.md"
						className="sr-only"
						onChange={(e) => {
							const names = Array.from(e.target.files ?? []).map((file) => file.name)
							if (names.length) setFiles((prev) => [...prev, ...names])
						}}
					/>
					Attach Documents
					<Icon name="link" height={14} width={14} />
				</label>
				<span className="body-sm text-tertiary">{ATTACH_HINT}</span>
			</div>
			{files.length ? (
				<div className="flex flex-wrap gap-2">
					{files.map((name, index) => (
						<span
							key={`${name}-${index}`}
							className="flex items-center gap-1.5 rounded-full border border-medium bg-surface-elevated-1 px-3 py-1 font-jetbrains body-sm"
						>
							{name}
							<button
								type="button"
								aria-label={`Remove ${name}`}
								className="cursor-pointer text-secondary hover:text-primary"
								onClick={() => setFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
							>
								<Icon name="x" height={12} width={12} />
							</button>
						</span>
					))}
				</div>
			) : null}
		</div>
	)
}

function LabeledField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="label-md text-primary">{label}</span>
			{children}
			{error ? <span className="body-sm text-error">{error}</span> : null}
		</div>
	)
}

function CellInput({
	column,
	value,
	onChange
}: {
	column: ClaimColumn
	value: string
	onChange: (value: string) => void
}) {
	if (column.type === 'select') {
		const options = column.options ?? []
		return (
			<select
				className={`${inputStyles} w-full cursor-pointer`}
				value={value}
				disabled={!options.length}
				onChange={(e) => onChange(e.target.value)}
			>
				<option value="">{options.length ? '' : 'NO DATA YET'}</option>
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		)
	}
	if (column.type === 'percent' || column.type === 'months') {
		return (
			<span className={`${inputStyles} flex w-full items-center gap-1`}>
				<input
					value={value}
					onChange={(e) => onChange(e.target.value)}
					inputMode="decimal"
					className="w-full min-w-0 bg-transparent focus:outline-hidden"
				/>
				<span className="shrink-0 text-tertiary">{column.type === 'percent' ? '%' : 'months'}</span>
			</span>
		)
	}
	return (
		<Input
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={column.placeholder}
			maxLength={500}
			className="w-full"
		/>
	)
}

function withExchangeOptions(section: ClaimTableSection, exchangeOptions: string[]): ClaimTableSection {
	if (section.id !== 'exchanges') return section
	return {
		...section,
		columns: section.columns.map((column) =>
			column.key === 'exchange' ? { ...column, options: exchangeOptions } : column
		)
	}
}

function InlineTableSection({
	section,
	rows,
	onChange
}: {
	section: ClaimTableSection
	rows: Record<string, string>[]
	onChange: (rows: Record<string, string>[]) => void
}) {
	return (
		<div className="flex flex-col gap-3">
			<h3 className="heading-xs">{section.title}</h3>
			{section.description ? <p className="body-sm text-secondary">{section.description}</p> : null}
			{section.columns.length ? (
				<>
					<div className="overflow-x-auto rounded-lg border border-subtle">
						<table className="w-full border-collapse body-sm">
							<thead>
								<tr className="border-b border-subtle">
									{section.columns.map((column) => (
										<th key={column.key} className="px-3 py-2.5 text-left label-sm text-secondary">
											{column.label}
										</th>
									))}
									<th aria-label="Row actions" />
								</tr>
							</thead>
							<tbody>
								{rows.map((row, rowIndex) => (
									<tr key={rowIndex} className="border-b border-subtle last:border-b-0">
										{section.columns.map((column) => (
											<td key={column.key} className="min-w-[140px] px-2 py-2">
												<CellInput
													column={column}
													value={row[column.key] ?? ''}
													onChange={(value) =>
														onChange(
															rows.map((entry, entryIndex) =>
																entryIndex === rowIndex ? { ...entry, [column.key]: value } : entry
															)
														)
													}
												/>
											</td>
										))}
										<td className="w-10 px-2 py-2">
											<Button
												type="button"
												size="sm"
												square
												aria-label="Delete row"
												onClick={() => onChange(rows.filter((_, entryIndex) => entryIndex !== rowIndex))}
											>
												<Icon name="trash-2" height={14} width={14} />
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<span>
						<Button
							type="button"
							size="md"
							onClick={() => onChange([...rows, Object.fromEntries(section.columns.map((column) => [column.key, '']))])}
						>
							Add More
							<Icon name="plus" height={14} width={14} />
						</Button>
					</span>
				</>
			) : (
				<AttachDocuments id={`attach-${section.id}`} />
			)}
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
				<li>
					Scores in the Universal Token Rating will be automatically improved based on the volume of information
					provided in your request.
				</li>
				<li>
					You can always add or modify data of your token via Forgd.com. A new verified account will be assigned to you
					for future management.
				</li>
			</ol>
		</Card>
	)
}

export function ClaimTokenProfile({
	variant = 'claim',
	projects = [],
	exchangeOptions = []
}: {
	variant?: 'claim' | 'join'
	projects?: UtrClaimProjectOption[]
	exchangeOptions?: string[]
}) {
	const [token, setToken] = useState<string>(variant === 'claim' ? (projects[0]?.arcticId ?? '') : '')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [position, setPosition] = useState('')
	const [profileUrl, setProfileUrl] = useState('')
	const [email, setEmail] = useState('')
	const [telegram, setTelegram] = useState('')
	const [alignmentConsent, setAlignmentConsent] = useState(false)
	const [termsConsent, setTermsConsent] = useState(false)
	const [mmMonitoring, setMmMonitoring] = useState<'yes' | 'no'>('yes')
	const [rowsBySection, setRowsBySection] = useState<Record<string, Record<string, string>[]>>(() =>
		Object.fromEntries(
			CLAIM_BLOCKS.flatMap((block) => block.sections.map((section) => [section.id, section.initialRows]))
		)
	)
	const [submitAttempted, setSubmitAttempted] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const [scoringCriteriaOpen, setScoringCriteriaOpen] = useState(false)

	const errors: Record<string, string | null> = {
		token: variant === 'claim' && token.trim() === '' ? 'Select the token to claim' : null,
		firstName: firstName.trim() === '' ? 'First name is required' : null,
		lastName: lastName.trim() === '' ? 'Last name is required' : null,
		email:
			email.trim() === ''
				? 'Email is required'
				: !EMAIL_PATTERN.test(email.trim())
					? 'Enter a valid email address'
					: null,
		profileUrl:
			profileUrl.trim() !== '' && !SOCIAL_PROFILE_PATTERN.test(profileUrl.trim())
				? 'Enter a valid LinkedIn or X URL'
				: null,
		consents: !alignmentConsent || !termsConsent ? 'Both consents are required to submit' : null
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
				selectedProject.disclosureScore == null ? null : `Disclosure ${selectedProject.disclosureScore.toFixed(2)}/10`
			]
				.filter(Boolean)
				.join(' · ')
		: null

	const onSubmit = () => {
		if (!isValid) {
			setSubmitAttempted(true)
			return
		}
		setSubmitted(true)
		window.scrollTo({ top: 0 })
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-1 pt-4 text-center">
				<h1 className="text-xl">
					<strong className="font-bold">Universal Token Rating</strong>
					{variant === 'claim' ? ' - Claim Your Token Profile' : ' - Join the Universal Token Rating'}
				</h1>
				<p className="body-sm text-tertiary">
					Provide as much information as possible. All fields are optional unless otherwise noted. Powered by Forgd
				</p>
			</div>

			{submitted ? (
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
									<span className="rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 font-jetbrains label-sm text-secondary">
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
							<LabeledField label="Position at organization">
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
							<LabeledField label="Your email address" error={showError('email')}>
								<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} />
							</LabeledField>
							<LabeledField label="Telegram handle (optional)">
								<Input value={telegram} onChange={(e) => setTelegram(e.target.value)} maxLength={64} />
							</LabeledField>
						</div>
						<LabeledField label="Other support document (optional)">
							<AttachDocuments id="attach-affiliation" />
						</LabeledField>
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
					</Card>

					<h2 className="heading-sm">Disclosures Details</h2>
					{CLAIM_BLOCKS.map((block) => (
						<Card key={block.id} padding="md" className="flex flex-col gap-5">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle pb-3">
								<h2 className="heading-sm">{block.title}</h2>
								<Button type="button" size="md" onClick={() => setScoringCriteriaOpen(true)}>
									View Scoring Criteria
								</Button>
							</div>
							<p className="body-sm text-secondary">
								Complete each section to the best of your ability. You may also upload supporting materials containing
								the requested information, including exchange intake forms, internal project documentation or similar
								records.
							</p>
							{block.sections.map((section) => (
								<InlineTableSection
									key={section.id}
									section={withExchangeOptions(section, exchangeOptions)}
									rows={rowsBySection[section.id]}
									onChange={(rows) => setRowsBySection((prev) => ({ ...prev, [section.id]: rows }))}
								/>
							))}
							{block.extras?.mmMonitoringQuestion ? (
								<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-elevated-1 px-3 py-2">
									<span className="label-md text-primary">
										Are you willing to verify these engagements through Forgd's free-to-use Market Maker Monitoring
										tool?
									</span>
									<SegmentedControl
										value={mmMonitoring}
										onValueChange={(value) => setMmMonitoring(value)}
										options={[
											{ value: 'no', label: 'No' },
											{ value: 'yes', label: 'Yes' }
										]}
										label="Market Maker Monitoring"
										variant="default"
										size="sm"
										className="w-fit"
									/>
								</div>
							) : null}
							<div className="flex flex-col gap-2 border-t border-subtle pt-4">
								<h3 className="heading-xs">Other support document (optional)</h3>
								<p className="body-sm text-secondary">
									Upload any additional documentation that supports or provides further context for the disclosures
									above.
								</p>
								<AttachDocuments id={`attach-${block.id}`} />
							</div>
						</Card>
					))}

					<Button type="button" variant="primary" size="md" className="w-full justify-center" onClick={onSubmit}>
						Submit Disclosure Details
						<Icon name="arrow-up-right" height={14} width={14} />
					</Button>
				</div>
			)}
			<UtrDocsDrawer
				open={scoringCriteriaOpen}
				onClose={() => setScoringCriteriaOpen(false)}
				initialChapterId="disclosure-axis"
			/>
		</div>
	)
}
