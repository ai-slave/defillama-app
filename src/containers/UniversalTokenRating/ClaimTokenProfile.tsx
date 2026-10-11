import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { Fragment, type MouseEvent, useId, useRef, useState } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { ClaimTurnstile, isClaimTurnstileEnabled } from '~/containers/MarketMakers/ClaimTurnstile'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { Field } from '~/ui/Field'
import { focusNeighbourOnLeave, keepFocus, showFieldErrors, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { UploadTile } from '~/ui/UploadTile'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { readSingleQueryValue } from '~/utils/routerQuery'
import { submitUtrClaim, uploadUtrClaimDocuments } from './claimClient'
import {
	CLAIM_BLOCKS,
	CLAIM_DISCLOSURE_SECTIONS,
	type ClaimColumn,
	type ClaimSelectOption,
	type ClaimTableSection
} from './claimFormConfig'
import {
	buildUtrClaimRequest,
	UTR_CLAIM_DOCUMENT_KEYS,
	UTR_CLAIM_FILE_ACCEPT,
	validateUtrClaimFiles,
	type UtrClaimDocumentKey,
	type UtrClaimDocuments,
	type UtrClaimFormRow,
	type UtrClaimRows
} from './claimRequest'
import { formatClaimProjectStatus, resolveRequestedProjectId } from './navigation'
import type {
	UtrClaimExchangeOption,
	UtrClaimMarketMakerOption,
	UtrClaimProjectOption,
	UtrScoringConfig
} from './types'
import { UtrDocsDrawer } from './UtrDocsDrawer'

const ATTACH_HINT = 'Supported formats: PDF, DOCX, XLSX, TXT, MD - Max file size: 10mb'

type ClaimDraftRow = { id: string; values: UtrClaimFormRow }
type ClaimDraftRows = Record<keyof UtrClaimRows, Array<ClaimDraftRow>>

type UploadStatus = { state: 'idle' } | { state: 'uploading' } | { state: 'failed'; error: string }

function createEmptyDocuments(): UtrClaimDocuments {
	return Object.fromEntries(UTR_CLAIM_DOCUMENT_KEYS.map((key) => [key, []])) as UtrClaimDocuments
}

function createUploadStatuses(): Record<UtrClaimDocumentKey, UploadStatus> {
	return Object.fromEntries(UTR_CLAIM_DOCUMENT_KEYS.map((key) => [key, { state: 'idle' }])) as Record<
		UtrClaimDocumentKey,
		UploadStatus
	>
}

/** The form's mark for a mandatory field, explained by its "*Mandatory fields" note. */
function requiredLabel(label: string) {
	return (
		<>
			{label}
			<span aria-hidden="true">*</span>
		</>
	)
}

type CellControlProps = { 'aria-invalid': true | undefined; 'aria-describedby': string | undefined }

const CLEAR_CELL = '__clear__'
function CellInput({
	column,
	control,
	value,
	onChange
}: {
	column: ClaimColumn
	control: CellControlProps
	value: string
	onChange: (value: string) => void
}) {
	if (column.type === 'select') {
		const options = column.options ?? []
		return (
			<SelectWithCombobox
				heading={column.label}
				// The native select's empty first option let a reader clear a cell; None keeps that.
				allValues={[
					{ key: CLEAR_CELL, name: 'None' },
					...options.map((option) => ({ key: option.value, name: option.label }))
				]}
				selectedValues={value ? [value] : []}
				setSelectedValues={(values) => onChange(!values[0] || values[0] === CLEAR_CELL ? '' : values[0])}
				singleSelect
				label={options.find((option) => option.value === value)?.label ?? 'Choose…'}
				labelType="none"
				variant="input"
				size="md"
				className="w-full"
				triggerProps={{
					...control,
					'aria-label': column.label,
					disabled: column.optionSource != null && options.length === 0
				}}
			/>
		)
	}
	if (column.type === 'percent' || column.type === 'months') {
		return (
			<Input
				{...control}
				aria-label={column.label}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				inputMode={column.type === 'months' ? 'numeric' : 'decimal'}
				suffix={column.type === 'percent' ? '%' : 'months'}
				className="w-full"
			/>
		)
	}
	return (
		<Input
			{...control}
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

/** A disclosure table. After a submit, every invalid cell is marked and the section's first error shows under the
    table, so showFieldErrors focuses the first invalid cell. `errors` is null until the first submit. */
function InlineTableSection({
	section,
	rows,
	errors,
	onChange
}: {
	section: ClaimTableSection
	rows: Array<ClaimDraftRow>
	errors: Record<string, string> | null
	onChange: (rows: Array<ClaimDraftRow>) => void
}) {
	const errorId = `${useId()}-error`
	const error = errors ? firstSectionError(errors, section.id) : null
	const addRef = useRef<HTMLButtonElement>(null)
	return (
		<div data-invalid={error ? '' : undefined} className="flex flex-col gap-3">
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
								<tr key={row.id} data-row className="border-b border-subtle last:border-b-0">
									{section.columns.map((column) => (
										<td key={column.key} className="min-w-[160px] px-2 py-2">
											<CellInput
												column={column}
												control={
													errors?.[`${section.id}.${rowIndex}.${column.key}`]
														? { 'aria-invalid': true, 'aria-describedby': errorId }
														: { 'aria-invalid': undefined, 'aria-describedby': undefined }
												}
												value={row.values[column.key] ?? ''}
												onChange={(value) => {
													const selectedOption = column.options?.find((option) => option.value === value)
													onChange(
														rows.map((entry, entryIndex) =>
															entryIndex === rowIndex
																? {
																		...entry,
																		values: {
																			...entry.values,
																			[column.key]: value,
																			...(column.linkedNameKey
																				? { [column.linkedNameKey]: selectedOption?.label ?? '' }
																				: null)
																		}
																	}
																: entry
														)
													)
												}}
											/>
										</td>
									))}
									{/* The md square matches the 32px inputs beside it; w-12 holds it inside the cell padding. */}
									<td className="w-12 px-2 py-2">
										<Tooltip
											content="Delete row"
											render={
												<Button
													type="button"
													variant="ghostDestructive"
													size="md"
													square
													aria-label={`Delete row ${rowIndex + 1} from ${section.title}`}
													ref={focusNeighbourOnLeave(() => addRef.current)}
													onClick={() => onChange(rows.filter((_, entryIndex) => entryIndex !== rowIndex))}
												/>
											}
										>
											<Icon name="trash-2" className="size-4" />
										</Tooltip>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
			{error ? (
				<p id={errorId} className="body-sm text-error">
					{error}
				</p>
			) : null}
			<span>
				{/* Add more disables itself at the row limit; it stays focusable so focus does not drop to the page. */}
				<Button
					type="button"
					size="md"
					ref={addRef}
					accessibleWhenDisabled
					disabled={rows.length >= 100}
					onClick={() => onChange([...rows, { id: crypto.randomUUID(), values: {} }])}
				>
					Add more
					<Icon name="plus" className="size-3.5" />
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
	const inputRef = useRef<HTMLInputElement>(null)
	const tileRef = useRef<HTMLButtonElement>(null)
	return (
		<div className="flex flex-col gap-2">
			{/* The tile keeps focus while the upload it started runs, and at the 10-file limit. */}
			<UploadTile
				ref={tileRef}
				id={id}
				shape="wide"
				icon="link"
				label="Attach documents"
				hint={ATTACH_HINT}
				pendingLabel="Uploading…"
				pending={status.state === 'uploading'}
				disabled={receipts.length >= 10}
				onClick={() => inputRef.current!.click()}
			/>
			<input
				ref={inputRef}
				type="file"
				multiple
				accept={UTR_CLAIM_FILE_ACCEPT}
				hidden
				onChange={(event) => {
					const files = Array.from(event.target.files ?? [])
					event.target.value = ''
					if (files.length > 0) onFiles(files)
				}}
			/>
			{receipts.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{keyedOccurrences(receipts, (receipt) => receipt.key).map(({ item: receipt, key }, index) => (
						<span
							key={key}
							data-row
							className="flex items-center gap-1 rounded-full border border-medium bg-surface-elevated-1 py-0.5 pr-1 pl-3 mono-sm"
						>
							{receipt.fileName}
							<Tooltip
								content="Remove"
								render={
									<Button
										variant="ghost"
										size="sm"
										square
										aria-label={`Remove ${receipt.fileName}`}
										ref={focusNeighbourOnLeave(() => tileRef.current)}
										onClick={() => onRemove(index)}
									/>
								}
							>
								<Icon name="x" className="size-4" />
							</Tooltip>
						</span>
					))}
				</div>
			) : null}
			{status.state === 'failed' ? (
				<InlineStatus
					variant="error"
					action={
						<Button size="sm" onClick={() => keepFocus(onClearError, () => tileRef.current)}>
							Dismiss
						</Button>
					}
				>
					{status.error}
				</InlineStatus>
			) : null}
		</div>
	)
}

function ClaimConfirmation() {
	return (
		<Card padding="md" className="mx-auto flex w-full max-w-3xl flex-col gap-5">
			<span className="flex size-16 items-center justify-center rounded-full border-2 border-success">
				<Icon name="check" className="size-7 text-success" />
			</span>
			{/* Replaces the form whose Submit had focus. */}
			<h2 ref={takeLostFocus} tabIndex={-1} className="heading-lg">
				Request received
			</h2>
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

// Throws from outside the try's own body: the compiler cannot lower a ThrowStatement inside one.
function assertReceiptsSigned(receipts: Array<{ signature?: string }>) {
	if (receipts.some((receipt) => !receipt.signature)) {
		throw new Error("Couldn't upload supporting documents.")
	}
}

const EMPTY_PROJECTS: Array<UtrClaimProjectOption> = []
const EMPTY_EXCHANGE_OPTIONS: Array<UtrClaimExchangeOption> = []
const EMPTY_MARKET_MAKER_OPTIONS: Array<UtrClaimMarketMakerOption> = []

export function ClaimTokenProfile({
	variant = 'claim',
	projects = EMPTY_PROJECTS,
	exchangeOptions = EMPTY_EXCHANGE_OPTIONS,
	marketMakerOptions = EMPTY_MARKET_MAKER_OPTIONS,
	scoringConfig
}: {
	variant?: 'claim' | 'join'
	projects?: Array<UtrClaimProjectOption>
	exchangeOptions?: Array<UtrClaimExchangeOption>
	marketMakerOptions?: Array<UtrClaimMarketMakerOption>
	scoringConfig?: UtrScoringConfig | null
}) {
	const router = useRouter()
	// Null until the reader picks or types a token. A claim link's ?token= preselects its project, which a static
	// page's query holds only after hydration, so the server and hydration renders show the first project.
	const [pickedToken, setToken] = useState<string | null>(null)
	const token =
		variant === 'claim'
			? (pickedToken ??
				resolveRequestedProjectId(projects, readSingleQueryValue(router.query.token)) ??
				projects[0]?.arcticId ??
				'')
			: (pickedToken ?? '')
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

	const [verifyMmEngagements, setVerifyMmEngagements] = useState(true)
	const [rows, setRows] = useState<ClaimDraftRows>(
		() => Object.fromEntries(CLAIM_DISCLOSURE_SECTIONS.map((section) => [section.id, []])) as ClaimDraftRows
	)
	const [documents, setDocuments] = useState<UtrClaimDocuments>(createEmptyDocuments)
	const [uploadStatuses, setUploadStatuses] = useState<Record<UtrClaimDocumentKey, UploadStatus>>(createUploadStatuses)
	const [submitted, setSubmitted] = useState(false)
	const [scoringCriteriaOpen, setScoringCriteriaOpen] = useState(false)
	const consentsErrorId = `${useId()}-error`
	const submitBlockerId = useId()
	const submit = useMutation({ mutationFn: submitUtrClaim })
	// The last failed submit, kept on screen while a retry runs: the mutation clears its error when the retry starts.
	const [submitError, setSubmitError] = useState<string | null>(null)
	const selectedProject = variant === 'claim' ? (projects.find((project) => project.arcticId === token) ?? null) : null
	const selectedProjectStatus = selectedProject ? formatClaimProjectStatus(selectedProject) : null

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
		rows: Object.fromEntries(
			Object.entries(rows).map(([key, entries]) => [key, entries.map((entry) => entry.values)])
		) as UtrClaimRows,
		verifyMmEngagements,
		documents,
		alignmentConsent,
		termsConsent,
		turnstileToken,
		clickId
	})
	const errors = buildUtrClaimRequest(requestInput(null)).errors
	const consentsError = submitted ? errors.consents : null
	// Gates, not validation: each keeps Submit disabled and says why beside it.
	const submitBlocker = Object.values(uploadStatuses).some((status) => status.state === 'uploading')
		? 'Wait for the documents to finish uploading.'
		: Object.values(uploadStatuses).some((status) => status.state === 'failed')
			? 'A document upload failed. Dismiss its error or attach the file again.'
			: captchaEnabled && !turnstileToken
				? 'Waiting for the security check above to finish.'
				: null

	const uploadDocuments = async (key: UtrClaimDocumentKey, files: Array<File>) => {
		const validationError = validateUtrClaimFiles(files, documents[key].length)
		if (validationError) {
			setUploadStatuses((current) => ({ ...current, [key]: { state: 'failed', error: validationError } }))
			return
		}
		setUploadStatuses((current) => ({ ...current, [key]: { state: 'uploading' } }))
		try {
			const receipts = await uploadUtrClaimDocuments(files)
			assertReceiptsSigned(receipts)
			setDocuments((current) => ({ ...current, [key]: [...current[key], ...receipts] }))
			setUploadStatuses((current) => ({ ...current, [key]: { state: 'idle' } }))
		} catch (error) {
			// claimClient and assertReceiptsSigned word every failure for readers. Read into a local: a caught
			// binding referenced from the updater closure is not consistently local.
			const message: string = error.message
			setUploadStatuses((current) => ({ ...current, [key]: { state: 'failed', error: message } }))
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
			onClearError={() => setUploadStatuses((current) => ({ ...current, [key]: { state: 'idle' } }))}
		/>
	)

	const onSubmit = (event: MouseEvent<HTMLButtonElement>) => {
		const clickId = new URL(window.location.href).searchParams.get('fgclick')?.trim() || null
		const result = buildUtrClaimRequest(requestInput(clickId))
		if (!result.payload) return showFieldErrors(event.currentTarget.form!, () => setSubmitted(true))
		submit.mutate(result.payload, {
			onSuccess: () => window.scrollTo({ top: 0 }),
			onError: (error) => {
				setSubmitError(error.message)
				setTurnstileToken('')
				turnstileRef.current?.reset()
			}
		})
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col items-center gap-1 pt-4 text-center">
				<h1 className="heading-sm">
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
				// Submit is type="button": with no submit button and many fields, Enter in a field never sends a half-filled
				// disclosure (the browser skips implicit submission). The form gives showFieldErrors its fields.
				<form noValidate className="mx-auto flex w-full max-w-5xl flex-col gap-6">
					<Card padding="md" className="flex flex-col gap-4">
						<div className="flex flex-col gap-1 border-b border-subtle pb-3">
							<h2 className="heading-sm">Verify your affiliation</h2>
							<p className="body-sm text-secondary">
								Tell us who you are and how you are affiliated with the project. We may contact you to verify your
								claim.
							</p>
						</div>
						{variant === 'claim' ? (
							<Field label="Token to claim" error={submitted ? errors.token : null}>
								{(control) => (
									<span className="flex flex-wrap items-center gap-2">
										<SelectWithCombobox
											heading="Token to claim"
											allValues={projects.map((project) => ({
												key: project.arcticId,
												name: `${project.projectName} (${project.symbol})`
											}))}
											selectedValues={token ? [token] : []}
											setSelectedValues={(values) => setToken(values[0] ?? '')}
											singleSelect
											label={
												selectedProject
													? `${selectedProject.projectName} (${selectedProject.symbol})`
													: 'Token list unavailable'
											}
											labelType="none"
											variant="input"
											size="md"
											className="min-w-64 flex-1"
											// The picker names its trigger with an aria-label, which would hide the Field's label.
											triggerProps={{ ...control, disabled: projects.length === 0 }}
										/>
										<span className="rounded-full border border-medium bg-surface-elevated-1 px-2.5 py-0.5 mono-sm text-secondary">
											{selectedProjectStatus ?? 'Token list unavailable'}
										</span>
									</span>
								)}
							</Field>
						) : (
							<Field label={requiredLabel('Token to claim')} error={submitted ? errors.token : null}>
								{(control) => (
									<Input
										{...control}
										required
										value={token}
										onChange={(event) => setToken(event.target.value)}
										maxLength={200}
									/>
								)}
							</Field>
						)}
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Field label={requiredLabel('First name')} error={submitted ? errors.firstName : null}>
								{(control) => (
									<Input
										{...control}
										required
										value={firstName}
										onChange={(event) => setFirstName(event.target.value)}
										maxLength={100}
									/>
								)}
							</Field>
							<Field label={requiredLabel('Last name')} error={submitted ? errors.lastName : null}>
								{(control) => (
									<Input
										{...control}
										required
										value={lastName}
										onChange={(event) => setLastName(event.target.value)}
										maxLength={100}
									/>
								)}
							</Field>
							<Field label={requiredLabel('Position at organization')} error={submitted ? errors.position : null}>
								{(control) => (
									<Input
										{...control}
										required
										value={position}
										onChange={(event) => setPosition(event.target.value)}
										maxLength={200}
										placeholder="E.g., CEO"
									/>
								)}
							</Field>
							<Field label="Your LinkedIn or X profile" error={submitted ? errors.profileUrl : null}>
								{(control) => (
									<Input
										{...control}
										value={profileUrl}
										onChange={(event) => setProfileUrl(event.target.value)}
										maxLength={500}
										placeholder="Enter a valid LinkedIn or X URL"
									/>
								)}
							</Field>
							<Field label={requiredLabel('Your email address')} error={submitted ? errors.email : null}>
								{(control) => (
									<Input
										{...control}
										type="email"
										required
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										maxLength={320}
									/>
								)}
							</Field>
							<Field label="Telegram handle">
								{(control) => (
									<Input
										{...control}
										value={telegram}
										onChange={(event) => setTelegram(event.target.value)}
										maxLength={100}
									/>
								)}
							</Field>
						</div>
						<div className="flex flex-col gap-1">
							<span className="label-sm text-secondary">Other support document (optional)</span>
							{documentUploader('alignment', 'attach-alignment')}
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
								onChange={(event) => setAlignmentConsent(event.target.checked)}
							>
								I agree to verify my alignment with the organization to confirm the claim.*
							</Checkbox>
							<Checkbox
								variant="consent"
								aria-invalid={consentsError && !termsConsent ? true : undefined}
								aria-describedby={consentsError ? consentsErrorId : undefined}
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
							{consentsError ? (
								<p id={consentsErrorId} className="body-sm text-error">
									{consentsError}
								</p>
							) : null}
							<span className="body-sm text-tertiary">*Mandatory fields</span>
						</div>
						<ClaimTurnstile ref={turnstileRef} onVerify={setTurnstileToken} onError={() => setTurnstileToken('')} />
					</Card>

					<h2 className="heading-sm">Disclosure details</h2>
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
											errors={submitted ? errors : null}
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
								<h3 className="heading-xs">{block.id === 'legal' ? '3.' : '4.'} Other support document (optional)</h3>
								<p className="body-sm text-secondary">
									{block.documentDescription ??
										'Upload any additional documentation that supports or provides further context for the disclosures above.'}
								</p>
								{documentUploader(block.documentKey, `attach-${block.documentKey}`)}
							</div>
						</Card>
					))}

					{submitError ? <InlineStatus variant="error">{submitError}</InlineStatus> : null}
					{submitBlocker ? (
						<p id={submitBlockerId} className="body-sm text-tertiary">
							{submitBlocker}
						</p>
					) : null}
					{/* Focusable while disabled: a failed submit resets the verification check, which disables the pressed
					    button until it passes again. */}
					<Button
						type="button"
						variant="primary"
						size="md"
						className="w-full justify-center"
						pendingLabel="Submitting…"
						pending={submit.isPending}
						accessibleWhenDisabled
						disabled={submitBlocker !== null}
						aria-describedby={submitBlocker ? submitBlockerId : undefined}
						onClick={onSubmit}
					>
						Submit Disclosure Details
						<Icon name="arrow-up-right" className="size-3.5" />
					</Button>
				</form>
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
