import { EMAIL_PATTERN, normalizeSocialUrl, SOCIAL_PROFILE_PATTERN } from '~/containers/MarketMakers/leadShared'
import type { ClaimDisclosureSectionId } from './claimFormConfig'

export const UTR_CLAIM_DOCUMENT_KEYS = [
	'alignment',
	'teamOrg',
	'tokenomics',
	'treasuryCashFlows',
	'legal',
	'serviceProviders'
] as const

export type UtrClaimDocumentKey = (typeof UTR_CLAIM_DOCUMENT_KEYS)[number]

export type UtrClaimDocument = {
	[field: string]: unknown
	key: string
	fileName: string
	mimeType: string
	sizeBytes: number
	signature?: string | null
}

export type UtrClaimDocuments = Record<UtrClaimDocumentKey, Array<UtrClaimDocument>>
export type UtrClaimFormRow = Record<string, string>
export type UtrClaimRows = Record<ClaimDisclosureSectionId, Array<UtrClaimFormRow>>

export type UtrClaimDisclosures = {
	insiderIdentities: Array<{ name: string; role: string; profileUrl: string }>
	organizationalStructure: Array<{ companyName: string; jurisdiction: string; description: string }>
	insiderWallets: Array<{ walletAddress: string; allocationPct: number; ownerType: string }>
	tokenomicsGroups: Array<{
		groupName: string
		allocationPct: number
		groupCategory: string
		tgeUnlockPct: number
		lockUpDurationMonths: number
		cliffUnlockPct: number
		unlockDurationMonths: number
		unlockFrequency: 'Daily' | 'Monthly'
	}>
	externalAllocations: Array<{ counterpartyName: string; allocationPct: number; categorization: string }>
	multisigWallets: Array<{
		walletAddress: string
		thresholdRequired: number
		thresholdTotal: number
		signerNames: string
	}>
	licenses: Array<{ name: string; link?: string; description: string }>
	marketMakerEngagements: Array<{
		marketMakerId: string
		marketMakerName: string
		allocationPct: number
		engagementType: string
	}>
	verifyMmEngagements: boolean
	exchangeEngagements: Array<{
		exchangeId: string
		exchangeName: string
		commercialCommitment: boolean
		details?: string
	}>
	auditors: Array<{ name: string; type: string; link?: string }>
}

export type UtrClaimPayload = {
	coingeckoId: string | null
	tokenName: string
	tokenTicker?: string
	firstName: string
	lastName: string
	position: string
	socialProfileUrl?: string
	email: string
	telegram?: string
	disclosures: UtrClaimDisclosures
	documents: UtrClaimDocuments
	alignmentConsent: true
	termsConsent: true
	clickId?: string
	turnstileToken?: string
}

export type UtrClaimRequestInput = {
	coingeckoId: string | null
	tokenName: string
	tokenTicker: string
	firstName: string
	lastName: string
	position: string
	profileUrl: string
	email: string
	telegram: string
	rows: UtrClaimRows
	verifyMmEngagements: boolean
	documents: UtrClaimDocuments
	alignmentConsent: boolean
	termsConsent: boolean
	turnstileToken: string
	clickId: string | null
}

export type UtrClaimValidation = {
	payload: UtrClaimPayload | null
	errors: Record<string, string>
}

function requiredString(
	value: string | undefined,
	path: string,
	label: string,
	maxLength: number,
	errors: Record<string, string>
): string {
	const trimmed = value?.trim() ?? ''
	if (!trimmed) errors[path] = `${label} is required`
	else if (trimmed.length > maxLength) errors[path] = `${label} must be ${maxLength} characters or fewer`
	return trimmed
}

function optionalString(
	value: string | undefined,
	path: string,
	label: string,
	maxLength: number,
	errors: Record<string, string>
): string | undefined {
	const trimmed = value?.trim() ?? ''
	if (!trimmed) return undefined
	if (trimmed.length > maxLength) errors[path] = `${label} must be ${maxLength} characters or fewer`
	return trimmed
}

function httpUrl(
	value: string | undefined,
	path: string,
	label: string,
	maxLength: number,
	errors: Record<string, string>,
	required: boolean
): string | undefined {
	const trimmed = required
		? requiredString(value, path, label, maxLength, errors)
		: optionalString(value, path, label, maxLength, errors)
	if (!trimmed) return undefined
	try {
		const parsed = new URL(trimmed)
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('invalid protocol')
	} catch {
		errors[path] = `${label} must be a valid http(s) URL`
	}
	return trimmed
}

function numberInRange(
	value: string | undefined,
	path: string,
	label: string,
	min: number,
	max: number,
	errors: Record<string, string>,
	integer = false
): number {
	const trimmed = value?.trim() ?? ''
	const parsed = trimmed === '' ? Number.NaN : Number(trimmed)
	if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
		errors[path] = `${label} must be ${integer ? 'an integer ' : ''}between ${min} and ${max}`
	}
	return parsed
}

function isEmptyRow(row: UtrClaimFormRow): boolean {
	return Object.values(row).every((value) => value.trim() === '')
}

function rowPath(section: ClaimDisclosureSectionId, index: number, field: string) {
	return `${section}.${index}.${field}`
}

function activeRows(rows: UtrClaimRows, section: ClaimDisclosureSectionId, errors: Record<string, string>) {
	const active = rows[section].flatMap((row, index) => (isEmptyRow(row) ? [] : [{ row, index }]))
	if (active.length > 100) errors[section] = 'No more than 100 rows are allowed'
	return active.slice(0, 100)
}

function buildDisclosures(
	rows: UtrClaimRows,
	verifyMmEngagements: boolean,
	errors: Record<string, string>
): UtrClaimDisclosures {
	const insiderIdentities = activeRows(rows, 'insiderIdentities', errors).map(({ row, index }) => ({
		name: requiredString(row.name, rowPath('insiderIdentities', index, 'name'), 'Name', 200, errors),
		role: requiredString(row.role, rowPath('insiderIdentities', index, 'role'), 'Role', 120, errors),
		profileUrl:
			httpUrl(row.profileUrl, rowPath('insiderIdentities', index, 'profileUrl'), 'Profile URL', 500, errors, true) ?? ''
	}))

	const organizationalStructure = activeRows(rows, 'organizationalStructure', errors).map(({ row, index }) => ({
		companyName: requiredString(
			row.companyName,
			rowPath('organizationalStructure', index, 'companyName'),
			'Company name',
			200,
			errors
		),
		jurisdiction: requiredString(
			row.jurisdiction,
			rowPath('organizationalStructure', index, 'jurisdiction'),
			'Jurisdiction',
			120,
			errors
		),
		description: requiredString(
			row.description,
			rowPath('organizationalStructure', index, 'description'),
			'Description',
			500,
			errors
		)
	}))

	const insiderWallets = activeRows(rows, 'insiderWallets', errors).map(({ row, index }) => ({
		walletAddress: requiredString(
			row.walletAddress,
			rowPath('insiderWallets', index, 'walletAddress'),
			'Wallet address',
			120,
			errors
		),
		allocationPct: numberInRange(
			row.allocationPct,
			rowPath('insiderWallets', index, 'allocationPct'),
			'Allocation',
			0,
			100,
			errors
		),
		ownerType: requiredString(row.ownerType, rowPath('insiderWallets', index, 'ownerType'), 'Owner type', 120, errors)
	}))

	const tokenomicsGroups = activeRows(rows, 'tokenomicsGroups', errors).map(({ row, index }) => {
		const unlockFrequency = requiredString(
			row.unlockFrequency,
			rowPath('tokenomicsGroups', index, 'unlockFrequency'),
			'Unlock frequency',
			20,
			errors
		)
		if (unlockFrequency !== 'Daily' && unlockFrequency !== 'Monthly') {
			errors[rowPath('tokenomicsGroups', index, 'unlockFrequency')] = 'Unlock frequency must be Daily or Monthly'
		}
		return {
			groupName: requiredString(
				row.groupName,
				rowPath('tokenomicsGroups', index, 'groupName'),
				'Group name',
				200,
				errors
			),
			allocationPct: numberInRange(
				row.allocationPct,
				rowPath('tokenomicsGroups', index, 'allocationPct'),
				'Allocation',
				0,
				100,
				errors
			),
			groupCategory: requiredString(
				row.groupCategory,
				rowPath('tokenomicsGroups', index, 'groupCategory'),
				'Group category',
				120,
				errors
			),
			tgeUnlockPct: numberInRange(
				row.tgeUnlockPct,
				rowPath('tokenomicsGroups', index, 'tgeUnlockPct'),
				'TGE unlock',
				0,
				100,
				errors
			),
			lockUpDurationMonths: numberInRange(
				row.lockUpDurationMonths,
				rowPath('tokenomicsGroups', index, 'lockUpDurationMonths'),
				'Lock-up duration',
				0,
				600,
				errors,
				true
			),
			cliffUnlockPct: numberInRange(
				row.cliffUnlockPct,
				rowPath('tokenomicsGroups', index, 'cliffUnlockPct'),
				'Cliff unlock',
				0,
				100,
				errors
			),
			unlockDurationMonths: numberInRange(
				row.unlockDurationMonths,
				rowPath('tokenomicsGroups', index, 'unlockDurationMonths'),
				'Unlock duration',
				0,
				600,
				errors,
				true
			),
			unlockFrequency: unlockFrequency as 'Daily' | 'Monthly'
		}
	})

	const externalAllocations = activeRows(rows, 'externalAllocations', errors).map(({ row, index }) => ({
		counterpartyName: requiredString(
			row.counterpartyName,
			rowPath('externalAllocations', index, 'counterpartyName'),
			'Counterparty name',
			200,
			errors
		),
		allocationPct: numberInRange(
			row.allocationPct,
			rowPath('externalAllocations', index, 'allocationPct'),
			'Allocation',
			0,
			100,
			errors
		),
		categorization: requiredString(
			row.categorization,
			rowPath('externalAllocations', index, 'categorization'),
			'Categorization',
			120,
			errors
		)
	}))

	const multisigWallets = activeRows(rows, 'multisigWallets', errors).map(({ row, index }) => {
		const thresholdRequired = numberInRange(
			row.thresholdRequired,
			rowPath('multisigWallets', index, 'thresholdRequired'),
			'Required threshold',
			1,
			1000,
			errors,
			true
		)
		const thresholdTotal = numberInRange(
			row.thresholdTotal,
			rowPath('multisigWallets', index, 'thresholdTotal'),
			'Total threshold',
			1,
			1000,
			errors,
			true
		)
		if (Number.isFinite(thresholdRequired) && Number.isFinite(thresholdTotal) && thresholdRequired > thresholdTotal) {
			errors[rowPath('multisigWallets', index, 'thresholdRequired')] =
				'Required threshold must not exceed total threshold'
		}
		return {
			walletAddress: requiredString(
				row.walletAddress,
				rowPath('multisigWallets', index, 'walletAddress'),
				'Wallet address',
				120,
				errors
			),
			thresholdRequired,
			thresholdTotal,
			signerNames: requiredString(
				row.signerNames,
				rowPath('multisigWallets', index, 'signerNames'),
				'Signer names',
				1000,
				errors
			)
		}
	})

	const licenses = activeRows(rows, 'licenses', errors).map(({ row, index }) => {
		const link = httpUrl(row.link, rowPath('licenses', index, 'link'), 'Link', 500, errors, false)
		return {
			name: requiredString(row.name, rowPath('licenses', index, 'name'), 'Name', 200, errors),
			...(link ? { link } : null),
			description: requiredString(
				row.description,
				rowPath('licenses', index, 'description'),
				'Description',
				500,
				errors
			)
		}
	})

	const marketMakerEngagements = activeRows(rows, 'marketMakerEngagements', errors).map(({ row, index }) => ({
		marketMakerId: requiredString(
			row.marketMakerId,
			rowPath('marketMakerEngagements', index, 'marketMakerId'),
			'Market maker',
			100,
			errors
		),
		marketMakerName: requiredString(
			row.marketMakerName,
			rowPath('marketMakerEngagements', index, 'marketMakerName'),
			'Market maker name',
			200,
			errors
		),
		allocationPct: numberInRange(
			row.allocationPct,
			rowPath('marketMakerEngagements', index, 'allocationPct'),
			'Allocation',
			0,
			100,
			errors
		),
		engagementType: requiredString(
			row.engagementType,
			rowPath('marketMakerEngagements', index, 'engagementType'),
			'Engagement type',
			120,
			errors
		)
	}))

	const exchangeEngagements = activeRows(rows, 'exchangeEngagements', errors).map(({ row, index }) => {
		const commitment = requiredString(
			row.commercialCommitment,
			rowPath('exchangeEngagements', index, 'commercialCommitment'),
			'Commercial commitment',
			5,
			errors
		)
		if (commitment !== 'true' && commitment !== 'false') {
			errors[rowPath('exchangeEngagements', index, 'commercialCommitment')] = 'Commercial commitment must be Yes or No'
		}
		const details = optionalString(
			row.details,
			rowPath('exchangeEngagements', index, 'details'),
			'Details',
			500,
			errors
		)
		return {
			exchangeId: requiredString(
				row.exchangeId,
				rowPath('exchangeEngagements', index, 'exchangeId'),
				'Exchange',
				100,
				errors
			),
			exchangeName: requiredString(
				row.exchangeName,
				rowPath('exchangeEngagements', index, 'exchangeName'),
				'Exchange name',
				200,
				errors
			),
			commercialCommitment: commitment === 'true',
			...(details ? { details } : null)
		}
	})

	const auditors = activeRows(rows, 'auditors', errors).map(({ row, index }) => {
		const link = httpUrl(row.link, rowPath('auditors', index, 'link'), 'Link', 500, errors, false)
		return {
			name: requiredString(row.name, rowPath('auditors', index, 'name'), 'Name', 200, errors),
			type: requiredString(row.type, rowPath('auditors', index, 'type'), 'Type', 120, errors),
			...(link ? { link } : null)
		}
	})

	return {
		insiderIdentities,
		organizationalStructure,
		insiderWallets,
		tokenomicsGroups,
		externalAllocations,
		multisigWallets,
		licenses,
		marketMakerEngagements,
		verifyMmEngagements,
		exchangeEngagements,
		auditors
	}
}

function validateDocuments(documents: UtrClaimDocuments, errors: Record<string, string>): UtrClaimDocuments {
	for (const key of UTR_CLAIM_DOCUMENT_KEYS) {
		if (documents[key].length > 10) errors[`documents.${key}`] = 'No more than 10 documents are allowed'
		for (const [index, document] of documents[key].entries()) {
			const path = `documents.${key}.${index}`
			if (
				typeof document.key !== 'string' ||
				!document.key ||
				typeof document.fileName !== 'string' ||
				!document.fileName ||
				typeof document.mimeType !== 'string' ||
				!document.mimeType ||
				typeof document.sizeBytes !== 'number' ||
				!Number.isFinite(document.sizeBytes) ||
				document.sizeBytes < 0
			) {
				errors[path] = 'Invalid document receipt'
			} else if (typeof document.signature !== 'string' || !document.signature) {
				errors[path] = 'Document receipt is missing its signature'
			}
		}
	}
	return documents
}

export function buildUtrClaimRequest(input: UtrClaimRequestInput): UtrClaimValidation {
	const errors: Record<string, string> = {}
	const tokenName = requiredString(input.tokenName, 'token', 'Token name', 200, errors)
	const tokenTicker = optionalString(input.tokenTicker, 'tokenTicker', 'Token ticker', 30, errors)
	const firstName = requiredString(input.firstName, 'firstName', 'First name', 100, errors)
	const lastName = requiredString(input.lastName, 'lastName', 'Last name', 100, errors)
	const position = requiredString(input.position, 'position', 'Position', 200, errors)
	const email = requiredString(input.email, 'email', 'Email', 320, errors)
	if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address'

	const normalizedProfileUrl = input.profileUrl.trim() ? normalizeSocialUrl(input.profileUrl.trim()) : ''
	if (normalizedProfileUrl && !SOCIAL_PROFILE_PATTERN.test(normalizedProfileUrl)) {
		errors.profileUrl = 'Enter a valid LinkedIn or X URL'
	}
	if (normalizedProfileUrl.length > 500) errors.profileUrl = 'Profile URL must be 500 characters or fewer'

	const telegram = optionalString(input.telegram, 'telegram', 'Telegram handle', 100, errors)
	const clickId = input.clickId?.trim() || undefined
	const turnstileToken = input.turnstileToken.trim() || undefined
	const coingeckoId = input.coingeckoId?.trim() || null
	if (coingeckoId && coingeckoId.length > 100) errors.token = 'CoinGecko id must be 100 characters or fewer'
	if (!input.alignmentConsent || !input.termsConsent) errors.consents = 'Both consents are required to submit'

	const disclosures = buildDisclosures(input.rows, input.verifyMmEngagements, errors)
	const documents = validateDocuments(input.documents, errors)

	if (Object.keys(errors).length > 0) return { payload: null, errors }
	return {
		payload: {
			coingeckoId,
			tokenName,
			...(tokenTicker ? { tokenTicker } : null),
			firstName,
			lastName,
			position,
			...(normalizedProfileUrl ? { socialProfileUrl: normalizedProfileUrl } : null),
			email,
			...(telegram ? { telegram } : null),
			disclosures,
			documents,
			alignmentConsent: true,
			termsConsent: true,
			...(clickId ? { clickId } : null),
			...(turnstileToken ? { turnstileToken } : null)
		},
		errors
	}
}

export const UTR_CLAIM_FILE_ACCEPT = '.pdf,.docx,.xlsx,.txt,.md'
export const UTR_CLAIM_MAX_FILE_BYTES = 10 * 1024 * 1024
const UTR_CLAIM_FILE_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'txt', 'md'])

export function validateUtrClaimFiles(files: ReadonlyArray<File>, existingCount: number): string | null {
	if (files.length === 0) return 'Select at least one document'
	if (existingCount + files.length > 10) return 'No more than 10 documents are allowed in this section'
	for (const file of files) {
		const extension = file.name.split('.').at(-1)?.toLowerCase() ?? ''
		if (!UTR_CLAIM_FILE_EXTENSIONS.has(extension)) {
			return `${file.name}: supported formats are PDF, DOCX, XLSX, TXT and MD`
		}
		if (file.size > UTR_CLAIM_MAX_FILE_BYTES) return `${file.name}: maximum file size is 10 MB`
	}
	return null
}
