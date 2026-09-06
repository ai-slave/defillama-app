import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useMutation } from '@tanstack/react-query'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ClaimTurnstile, isClaimTurnstileEnabled } from '~/containers/MarketMakers/ClaimTurnstile'
import { LeadError } from '~/containers/MarketMakers/LeadDialog'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'
import { submitUtrClaim, uploadUtrClaimDocuments } from './claimClient'
import { CLAIM_BLOCKS, type ClaimColumn, type ClaimSelectOption, type ClaimTableSection } from './claimFormConfig'
import {
	buildUtrClaimRequest,
	createEmptyUtrClaimRows,
	UTR_CLAIM_DOCUMENT_KEYS,
	UTR_CLAIM_FILE_ACCEPT,
	validateUtrClaimFiles,
	type UtrClaimDocumentKey,
	type UtrClaimDocuments,
	type UtrClaimFormRow,
	type UtrClaimRows
} from './claimRequest'
import { resolveRequestedProjectId } from './navigation'
import { scrollToFirstUtrClaimError } from './scrollToClaimError'
import type {
	UtrClaimExchangeOption,
	UtrClaimMarketMakerOption,
	UtrClaimProjectOption,
	UtrScoringConfig
} from './types'
import { UtrDocsDrawer } from './UtrDocsDrawer'

const ATTACH_HINT = 'Supported formats: PDF, DOCX, XLSX, TXT, MD - Max file size: 10mb'

type UploadStatus = { pending: boolean; error: string | null }

function createEmptyDocuments(): UtrClaimDocuments {
	return Object.fromEntries(UTR_CLAIM_DOCUMENT_KEYS.map((key) => [key, []])) as UtrClaimDocuments
}

function createUploadStatuses(): Record<UtrClaimDocumentKey, UploadStatus> {
	return Object.fromEntries(UTR_CLAIM_DOCUMENT_KEYS.map((key) => [key, { pending: false, error: null }])) as Record<
		UtrClaimDocumentKey,
		UploadStatus
	>
}

function LabeledField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="label-md text-primary">{label}</span>
			{children}
			{error ? (
				<span data-utr-claim-error className="body-sm text-error">
					{error}
				</span>
			) : null}
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
				aria-label={column.label}
				value={value}
				disabled={column.optionSource != null && options.length === 0}
				onChange={(event) => onChange(event.target.value)}
			>
				<option value="" />
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		)
	}
	if (column.type === 'percent' || column.type === 'months') {
		return (
			<span className={`${inputStyles} flex w-full items-center gap-1`}>
				<input
					aria-label={column.label}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					inputMode={column.type === 'months' ? 'numeric' : 'decimal'}
					className="w-full min-w-0 bg-transparent focus:outline-hidden"
				/>
				<span className="shrink-0 text-tertiary">{column.type === 'percent' ? '%' : 'months'}</span>
			</span>
		)
	}
	return (
		<Input
			aria-label={column.label}
			type={column.type === 'url' ? 'url' : 'text'}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			inputMode={column.type === 'integer' ? 'numeric' : undefined}
			placeholder={column.placeholder}
			maxLength={column.key === 'signerNames' ? 1000 : 500}
			className="w-full"
		/>
	)
}

function sectionWithOptions(
	section: ClaimTableSection,
	marketMakerOptions: Array<UtrClaimMarketMakerOption>,
	exchangeOptions: Array<UtrClaimExchangeOption>
): ClaimTableSection {
	return {
		...section,
		columns: section.columns.map((column) => {
			let options: Array<ClaimSelectOption> | undefined
			if (column.optionSource === 'marketMakers') {
				options = marketMakerOptions.map(({ marketMakerId, marketMakerName }) => ({
					value: marketMakerId,
					label: marketMakerName
				}))
			} else if (column.optionSource === 'exchanges') {
				options = exchangeOptions.map(({ id, displayName }) => ({ value: id, label: displayName }))
			}
			return options ? { ...column, options } : column
		})
	}
}

function firstSectionError(errors: Record<string, string>, sectionId: string): string | null {
	return Object.entries(errors).find(([path]) => path === sectionId || path.startsWith(`${sectionId}.`))?.[1] ?? null
}

function InlineTableSection({
	section,
	rows,
	error,
	onChange
}: {
	section: ClaimTableSection
	rows: Array<UtrClaimFormRow>
	error: string | null
	onChange: (rows: Array<UtrClaimFormRow>) => void
}) {
	return (
		<div className="flex flex-col gap-3">
			<h3 className="heading-xs">{section.title}</h3>
			{section.description ? <p className="body-sm text-secondary">{section.description}</p> : null}
			{rows.length > 0 ? (
				<div className="overflow-x-auto rounded-lg border border-subtle">
					<table className="w-full border-collapse body-sm">
						<thead>
							<tr className="border-b border-subtle">
								{section.columns.map((column) => (
									<th key={column.key} className="px-3 py-2.5 text-left label-sm whitespace-nowrap text-secondary">
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
										<td key={column.key} className="min-w-[160px] px-2 py-2">
											<CellInput
												column={column}
												value={row[column.key] ?? ''}
												onChange={(value) => {
													const selectedOption = column.options?.find((option) => option.value === value)
													onChange(
														rows.map((entry, entryIndex) =>
															entryIndex === rowIndex
																? {
																		...entry,
																		[column.key]: value,
																		...(column.linkedNameKey
																			? { [column.linkedNameKey]: selectedOption?.label ?? '' }
																			: null)
																	}
																: entry
														)
													)
												}}
											/>
										</td>
									))}
									<td className="w-10 px-2 py-2">
										<Button
											type="button"
											size="sm"
											square
											aria-label={`Delete row ${rowIndex + 1} from ${section.title}`}
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
			) : null}
			{error ? (
				<span data-utr-claim-error className="body-sm text-error">
					{error}
				</span>
			) : null}
			<span>
				<Button type="button" size="md" disabled={rows.length >= 100} onClick={() => onChange([...rows, {}])}>
					Add More
					<Icon name="plus" height={14} width={14} />
				</Button>
			</span>
		</div>
	)
}

function AttachDocuments({
	id,
	receipts,
	status,
	onFiles,
	onRemove,
	onClearError
}: {
	id: string
	receipts: UtrClaimDocuments[UtrClaimDocumentKey]
	status: UploadStatus
	onFiles: (files: Array<File>) => void
	onRemove: (index: number) => void
	onClearError: () => void
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-3">
				<label
					htmlFor={id}
					className={`flex items-center gap-1.5 rounded-lg border border-medium px-3 py-1.5 label-md text-primary ${
						status.pending || receipts.length >= 10
							? 'cursor-not-allowed opacity-60'
							: 'cursor-pointer hover:bg-hover-row'
					}`}
				>
					<input
						id={id}
						type="file"
						multiple
						accept={UTR_CLAIM_FILE_ACCEPT}
						className="sr-only"
						disabled={status.pending || receipts.length >= 10}
						onChange={(event) => {
							const files = Array.from(event.target.files ?? [])
							event.target.value = ''
							if (files.length > 0) onFiles(files)
						}}
					/>
					{status.pending ? 'Uploading…' : 'Attach Documents'}
					<Icon name="link" height={14} width={14} />
				</label>
				<span className="body-sm text-tertiary">{ATTACH_HINT}</span>
			</div>
			{receipts.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{receipts.map((receipt, index) => (
						<span
							key={`${receipt.key}-${index}`}
							className="flex items-center gap-1.5 rounded-full border border-medium bg-surface-elevated-1 px-3 py-1 mono-sm"
						>
							{receipt.fileName}
							<button
								type="button"
								aria-label={`Remove ${receipt.fileName}`}
								className="cursor-pointer text-secondary hover:text-primary"
								onClick={() => onRemove(index)}
							>
								<Icon name="x" height={12} width={12} />
							</button>
						</span>
					))}
				</div>
			) : null}
			{status.error ? (
				<div data-utr-claim-error className="flex items-center gap-2 body-sm text-error">
					<span>{status.error}</span>
					<button type="button" className="underline" onClick={onClearError}>
						Dismiss
					</button>
				</div>
			) : null}
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
	projects = [],
	exchangeOptions = [],
	marketMakerOptions = [],
	scoringConfig
}: {
	variant?: 'claim' | 'join'
	projects?: Array<UtrClaimProjectOption>
	exchangeOptions?: Array<UtrClaimExchangeOption>
	marketMakerOptions?: Array<UtrClaimMarketMakerOption>
	scoringConfig?: UtrScoringConfig | null
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
	const [turnstileToken, setTurnstileToken] = useState('')
	const turnstileRef = useRef<TurnstileInstance | undefined>(undefined)
	const captchaEnabled = isClaimTurnstileEnabled()

	useEffect(() => {
		if (variant !== 'claim' || typeof window === 'undefined') return
		const requested = new URL(window.location.href).searchParams.get('token')
		const projectId = resolveRequestedProjectId(projects, requested)
		if (projectId) setToken(projectId)
	}, [projects, variant])
	const [verifyMmEngagements, setVerifyMmEngagements] = useState(true)
	const [rows, setRows] = useState<UtrClaimRows>(createEmptyUtrClaimRows)
	const [documents, setDocuments] = useState<UtrClaimDocuments>(createEmptyDocuments)
	const [uploadStatuses, setUploadStatuses] = useState<Record<UtrClaimDocumentKey, UploadStatus>>(createUploadStatuses)
	const [submitAttempted, setSubmitAttempted] = useState(false)
	const [scoringCriteriaOpen, setScoringCriteriaOpen] = useState(false)
	const formRef = useRef<HTMLDivElement>(null)
	const submit = useMutation({ mutationFn: submitUtrClaim })
	const scrollToError = () => window.requestAnimationFrame(() => scrollToFirstUtrClaimError(formRef.current))
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

	const requestInput = (clickId: string | null) => ({
		coingeckoId: selectedProject?.coingeckoId ?? null,
		tokenName: selectedProject?.projectName ?? token,
		tokenTicker: selectedProject?.symbol ?? '',
		firstName,
		lastName,
		position,
		profileUrl,
		email,
		telegram,
		rows,
		verifyMmEngagements,
		documents,
		alignmentConsent,
		termsConsent,
		turnstileToken,
		clickId
	})
	const validation = buildUtrClaimRequest(requestInput(null))
	const errors = {
		...validation.errors,
		...(captchaEnabled && !turnstileToken ? { captcha: 'Complete the CAPTCHA verification' } : null)
	}
	const showError = (key: string) => (submitAttempted ? errors[key] : null)
	const hasPendingUpload = Object.values(uploadStatuses).some((status) => status.pending)
	const hasUploadError = Object.values(uploadStatuses).some((status) => status.error)

	const uploadDocuments = async (key: UtrClaimDocumentKey, files: Array<File>) => {
		const validationError = validateUtrClaimFiles(files, documents[key].length)
		if (validationError) {
			setUploadStatuses((current) => ({ ...current, [key]: { pending: false, error: validationError } }))
			return
		}
		setUploadStatuses((current) => ({ ...current, [key]: { pending: true, error: null } }))
		try {
			const receipts = await uploadUtrClaimDocuments(files)
			if (receipts.some((receipt) => !receipt.signature)) throw new Error('A document receipt is missing its signature')
			setDocuments((current) => ({ ...current, [key]: [...current[key], ...receipts] }))
			setUploadStatuses((current) => ({ ...current, [key]: { pending: false, error: null } }))
		} catch (error) {
			setUploadStatuses((current) => ({
				...current,
				[key]: {
					pending: false,
					error: error instanceof Error ? error.message : 'Failed to upload supporting documents'
				}
			}))
		}
	}

	const documentUploader = (key: UtrClaimDocumentKey, id: string) => (
		<AttachDocuments
			id={id}
			receipts={documents[key]}
			status={uploadStatuses[key]}
			onFiles={(files) => void uploadDocuments(key, files)}
			onRemove={(index) =>
				setDocuments((current) => ({
					...current,
					[key]: current[key].filter((_, receiptIndex) => receiptIndex !== index)
				}))
			}
			onClearError={() => setUploadStatuses((current) => ({ ...current, [key]: { ...current[key], error: null } }))}
		/>
	)

	const onSubmit = () => {
		if (submit.isPending || hasPendingUpload || hasUploadError) return
		setSubmitAttempted(true)
		const clickId =
			typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('fgclick')?.trim() || null
		const result = buildUtrClaimRequest(requestInput(clickId))
		if (!result.payload || (captchaEnabled && !turnstileToken)) {
			scrollToError()
			return
		}
		submit.mutate(result.payload, {
			onSuccess: () => window.scrollTo({ top: 0 }),
			onError: () => {
				setTurnstileToken('')
				turnstileRef.current?.reset()
				scrollToError()
			}
		})
	}

	return (
		<div ref={formRef} className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-1 pt-4 text-center">
				<h1 className="text-xl">
					{variant === 'claim' ? (
						<>
							<strong className="font-bold">Universal Token Rating</strong> - Claim Your Token Profile
						</>
					) : (
						<strong className="font-bold">Join the Universal Token Rating profile</strong>
					)}
				</h1>
				<p className="body-sm text-tertiary">
					Provide as much information as possible. All fields are optional unless otherwise noted. Powered by Forgd
				</p>
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
										aria-label="Token to claim"
										value={token}
										disabled={projects.length === 0}
										onChange={(event) => setToken(event.target.value)}
									>
										{projects.length > 0 ? null : <option value="">Token list unavailable</option>}
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
							<LabeledField label="Token to claim*" error={showError('token')}>
								<Input
									aria-label="Token to claim"
									value={token}
									onChange={(event) => setToken(event.target.value)}
									maxLength={200}
								/>
							</LabeledField>
						)}
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<LabeledField label="First Name*" error={showError('firstName')}>
								<Input
									aria-label="First Name"
									value={firstName}
									onChange={(event) => setFirstName(event.target.value)}
									maxLength={100}
								/>
							</LabeledField>
							<LabeledField label="Last Name*" error={showError('lastName')}>
								<Input
									aria-label="Last Name"
									value={lastName}
									onChange={(event) => setLastName(event.target.value)}
									maxLength={100}
								/>
							</LabeledField>
							<LabeledField label="Position at organization*" error={showError('position')}>
								<Input
									aria-label="Position at organization"
									value={position}
									onChange={(event) => setPosition(event.target.value)}
									maxLength={200}
									placeholder="E.g., CEO"
								/>
							</LabeledField>
							<LabeledField label="Your LinkedIn or X profile" error={showError('profileUrl')}>
								<Input
									aria-label="Your LinkedIn or X profile"
									value={profileUrl}
									onChange={(event) => setProfileUrl(event.target.value)}
									maxLength={500}
									placeholder="Enter a valid LinkedIn or X URL"
								/>
							</LabeledField>
							<LabeledField label="Your email address*" error={showError('email')}>
								<Input
									aria-label="Your email address"
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									maxLength={320}
								/>
							</LabeledField>
							<LabeledField label="Telegram handle">
								<Input
									aria-label="Telegram handle"
									value={telegram}
									onChange={(event) => setTelegram(event.target.value)}
									maxLength={100}
								/>
							</LabeledField>
						</div>
						<LabeledField label="Other support document (optional)">
							{documentUploader('alignment', 'attach-alignment')}
						</LabeledField>
						<div className="flex flex-col gap-1 border-t border-subtle pt-4">
							<Checkbox
								variant="inline"
								checked={alignmentConsent}
								onChange={(event) => setAlignmentConsent(event.target.checked)}
							>
								I agree to verify my alignment with the organization to confirm the claim.*
							</Checkbox>
							<Checkbox
								variant="inline"
								checked={termsConsent}
								onChange={(event) => setTermsConsent(event.target.checked)}
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
									.*
								</span>
							</Checkbox>
							{showError('consents') ? (
								<span data-utr-claim-error className="body-sm text-error">
									{showError('consents')}
								</span>
							) : null}
							<span className="body-sm text-tertiary">*Mandatory fields</span>
						</div>
						{captchaEnabled ? (
							<div className="flex flex-col items-center gap-1.5">
								<ClaimTurnstile
									ref={turnstileRef}
									onVerify={setTurnstileToken}
									onError={() => setTurnstileToken('')}
									className="w-full max-w-md"
								/>
								{showError('captcha') ? (
									<span data-utr-claim-error className="body-sm text-error">
										{showError('captcha')}
									</span>
								) : null}
							</div>
						) : null}
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
							{block.id !== 'legal' ? (
								<p className="body-sm text-secondary">
									Complete each section to the best of your ability. You may also upload supporting materials containing
									the requested information, including exchange intake forms, internal project documentation or similar
									records.
								</p>
							) : null}
							{block.additionalDocumentSection ? (
								<div className="flex flex-col gap-2">
									<h3 className="heading-xs">{block.additionalDocumentSection.title}</h3>
									<p className="body-sm text-secondary">{block.additionalDocumentSection.description}</p>
									{documentUploader(
										block.additionalDocumentSection.key,
										`attach-${block.additionalDocumentSection.key}`
									)}
								</div>
							) : null}
							{block.sections.map((rawSection) => {
								const section = sectionWithOptions(rawSection, marketMakerOptions, exchangeOptions)
								return (
									<Fragment key={section.id}>
										<InlineTableSection
											section={section}
											rows={rows[section.id]}
											error={submitAttempted ? firstSectionError(errors, section.id) : null}
											onChange={(nextRows) => setRows((current) => ({ ...current, [section.id]: nextRows }))}
										/>
										{block.extras?.mmMonitoringQuestion && section.id === 'marketMakerEngagements' ? (
											<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-elevated-1 px-3 py-2">
												<span className="label-md text-primary">
													Are you willing to verify these engagements through Forgd's free-to-use Market Maker
													Monitoring tool?
												</span>
												<SegmentedControl
													value={verifyMmEngagements ? 'yes' : 'no'}
													onValueChange={(value) => setVerifyMmEngagements(value === 'yes')}
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
									</Fragment>
								)
							})}
							<div className="flex flex-col gap-2 border-t border-subtle pt-4">
								<h3 className="heading-xs">
									{block.id === 'team' ? '4.' : block.id === 'tokenomics' ? '4.' : block.id === 'legal' ? '3.' : '4.'}{' '}
									Other support document (optional)
								</h3>
								<p className="body-sm text-secondary">
									{block.documentDescription ??
										'Upload any additional documentation that supports or provides further context for the disclosures above.'}
								</p>
								{documentUploader(block.documentKey, `attach-${block.documentKey}`)}
							</div>
						</Card>
					))}

					{submit.isError ? (
						<div data-utr-claim-error>
							<LeadError
								message={submit.error instanceof Error ? submit.error.message : 'Failed to submit the claim request'}
							/>
						</div>
					) : null}
					<Button
						type="button"
						variant="primary"
						size="md"
						className="w-full justify-center"
						disabled={submit.isPending || hasPendingUpload || hasUploadError || (captchaEnabled && !turnstileToken)}
						onClick={onSubmit}
					>
						{submit.isPending ? 'Submitting…' : 'Submit Disclosure Details'}
						<Icon name="arrow-up-right" height={14} width={14} />
					</Button>
				</div>
			)}
			<UtrDocsDrawer
				open={scoringCriteriaOpen}
				onClose={() => setScoringCriteriaOpen(false)}
				initialChapterId="disclosure-axis"
				scoringConfig={scoringConfig}
			/>
		</div>
	)
}
