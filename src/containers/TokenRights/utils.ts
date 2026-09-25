import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import type { IRawTokenRightsEntry } from './api.types'
import type {
	ITokenRightsData,
	ITokenRightsParsedAddress,
	ITokenRightsParsedLink,
	ITokenRightsTokenDisplay
} from './types'

function optionalText(value: string | undefined): string | null {
	return value?.trim() || null
}

/** A disclosed $0 round shows as $0; only an unknown amount shows as a dash. */
export function formatTokenRightsRaiseUsd(value: number | null): string {
	return value === null
		? '—'
		: formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

export function hasTokenRightsPrimaryValueAccrual({ valueAccrual }: ITokenRightsData): boolean {
	return valueAccrual.primary !== null || valueAccrual.details !== null
}

export function formatFeeSwitchStatus(value: string): string {
	switch (value) {
		case 'ON':
			return 'On'
		case 'OFF':
			return 'Off'
		case 'PENDING':
			return 'Pending'
		default:
			return value || 'Unknown'
	}
}

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const ANGLE_BRACKET_URL_RE = /<(https?:\/\/[^>]+)>/g

/**
 * Extract structured links from a string containing markdown `[label](url)` and/or
 * angle-bracket `<url>` patterns.
 */
function parseMarkdownLinks(raw: string | undefined): Array<ITokenRightsParsedLink> {
	if (!raw) return []

	const links: Array<ITokenRightsParsedLink> = []
	const seen = new Set<string>()

	for (const match of raw.matchAll(MARKDOWN_LINK_RE)) {
		const label = match[1]!
		const url = match[2]!.trim()
		if (!seen.has(url)) {
			seen.add(url)
			links.push({ label: label.trim(), url })
		}
	}

	for (const match of raw.matchAll(ANGLE_BRACKET_URL_RE)) {
		const url = match[1]!.trim()
		if (!seen.has(url)) {
			seen.add(url)
			links.push({ label: new URL(url).hostname, url })
		}
	}

	return links
}

const PIPE_PAIR_RE = /^(.+?)\s*\|\s*(.+)$/
const ACTIVE_STATUS_VALUES = new Set(['active', 'on', 'yes'])
const INACTIVE_TOKEN_VALUES = new Set(['', 'n/a', 'na', 'none', 'no', 'off', 'unknown'])

/**
 * Parse the "Foundation Multisigs / Addresses" field which uses mixed formats:
 *   - "label | address"
 *   - "label | value | label | value" (multiple pairs on one line)
 *   - bare hex addresses
 *   - bare URLs / angle-bracket URLs
 */
function parseAddresses(raw: string | undefined): Array<ITokenRightsParsedAddress> {
	if (!raw) return []

	const results: Array<ITokenRightsParsedAddress> = []
	const lines = raw
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)

	for (const line of lines) {
		const parts = line
			.split('|')
			.map((p) => p.trim())
			.filter(Boolean)

		if (parts.length >= 2 && parts.length % 2 === 0) {
			for (let i = 0; i < parts.length; i += 2) {
				results.push({ label: parts[i]!, value: parts[i + 1]! })
			}
		} else if (parts.length === 1) {
			const stripped = line.replace(/^<|>$/g, '')
			const colonUrl = stripped.match(/^(.+?):\s*(https?:\/\/\S+)$/i)
			if (colonUrl) {
				results.push({ label: colonUrl[1]!.trim(), value: colonUrl[2]! })
			} else {
				results.push({ label: null, value: stripped })
			}
		} else {
			const pipeMatch = line.match(PIPE_PAIR_RE)
			if (pipeMatch) {
				results.push({ label: pipeMatch[1]!, value: pipeMatch[2]! })
			} else {
				results.push({ label: null, value: line })
			}
		}
	}

	return results
}

function parseTokenDisplay(
	tokens: Array<string> | null | undefined
): ITokenRightsTokenDisplay & { tokens: Array<string> } {
	const values = tokens ?? []
	const displayTokens: Array<string> = []
	let fallbackToken = 'N/A'
	let hasFallbackToken = false

	for (const token of values) {
		if (!hasFallbackToken && token.trim()) {
			fallbackToken = token
			hasFallbackToken = true
		}
		if (!INACTIVE_TOKEN_VALUES.has(normalizeTokenRightsValue(token))) {
			displayTokens.push(token)
		}
	}

	return { tokens: values, displayTokens, fallbackToken }
}

function isActiveStatus(value: string): boolean {
	return ACTIVE_STATUS_VALUES.has(normalizeTokenRightsValue(value))
}

function normalizeTokenRightsValue(value: string): string {
	return value.trim().toLowerCase()
}

export type TokenRightsPieTone = 'positive' | 'negative' | 'warning'

export function getEquityPieTone(fundraising: Array<string>, equityRevenueCapture: string | null): TokenRightsPieTone {
	if (
		fundraising.some((value) => normalizeTokenRightsValue(value).includes('equity')) ||
		(equityRevenueCapture !== null && normalizeTokenRightsValue(equityRevenueCapture) === 'yes')
	) {
		return 'negative'
	}

	if (
		fundraising.length === 0 ||
		(fundraising.length === 1 && normalizeTokenRightsValue(fundraising[0]!) === 'unknown')
	) {
		return 'warning'
	}

	return 'positive'
}

/** Dividends or buybacks: either one means the token accrues value. */
export function hasTokenRightsValueAccrual({ valueAccrual }: ITokenRightsData): boolean {
	return valueAccrual.dividends.displayTokens.length > 0 || valueAccrual.buybacks.displayTokens.length > 0
}

/** The overview pie: one slice per right, green when the token holds it. */
export function getTokenRightsPieSegments(data: ITokenRightsData): Array<{ label: string; tone: TokenRightsPieTone }> {
	const { governance, decisions, valueAccrual, alignment } = data
	return [
		{ label: 'Treasury', tone: decisions.treasury.displayTokens.length > 0 ? 'positive' : 'negative' },
		{ label: 'Revenue', tone: decisions.revenue.displayTokens.length > 0 ? 'positive' : 'negative' },
		{ label: 'Burns', tone: valueAccrual.burns.isActive ? 'positive' : 'negative' },
		{ label: 'Equity', tone: getEquityPieTone(alignment.fundraising, alignment.equityRevenueCapture) },
		{ label: 'Value Accrual', tone: hasTokenRightsValueAccrual(data) ? 'positive' : 'negative' },
		{ label: 'Governance', tone: governance.decisionTokenDisplay.displayTokens.length > 0 ? 'positive' : 'negative' }
	]
}

function splitUtilityLabels(value: string | null): Array<string> {
	if (!value) return []
	return value
		.split(/[,;\n]+/)
		.map((item) => item.trim())
		.filter(Boolean)
}

function formatList(values: Array<string>): string | null {
	const activeValues: Array<string> = []
	for (const value of values) {
		if (value.trim()) activeValues.push(value)
	}
	return activeValues.length > 0 ? activeValues.join(', ') : null
}

/**
 * Transform a raw API entry into the fully predictable `ITokenRightsData` structure
 * consumed by the UI. Every section is always present; nullable fields use `null`.
 */
export function parseTokenRightsEntry(raw: IRawTokenRightsEntry): ITokenRightsData {
	const overviewTokens = parseTokenDisplay(raw.Token)
	const utility = optionalText(raw.Utility)
	const lastUpdated = optionalText(raw['Last Updated'])
	const primaryValueAccrual = optionalText(raw['Value Accrual'])
	const governanceDecisionTokens = parseTokenDisplay(raw['Governance Decisions'])
	const fundraising = raw.Fundraising ?? []

	return {
		overview: {
			protocolName: raw['Protocol Name'],
			tokens: overviewTokens.tokens,
			identityTokens: overviewTokens.displayTokens,
			tokenTypes: raw['Token Type'] ?? [],
			description: raw['Brief description']?.trim() ?? '',
			utility,
			utilityItems: splitUtilityLabels(utility),
			lastUpdated,
			lastUpdatedLabel: lastUpdated ? (formatDate(lastUpdated) ?? lastUpdated) : null
		},
		governance: {
			summary: raw['Governance Details (Summary)']?.trim() ?? '',
			decisionTokens: governanceDecisionTokens.tokens,
			decisionTokenDisplay: {
				displayTokens: governanceDecisionTokens.displayTokens,
				fallbackToken: governanceDecisionTokens.fallbackToken
			},
			details: optionalText(raw['Governance details']),
			links: parseMarkdownLinks(raw['Governance Links'])
		},
		decisions: {
			treasury: {
				...parseTokenDisplay(raw['Treasury Decisions']),
				details: optionalText(raw['Treasury Details'])
			},
			revenue: {
				...parseTokenDisplay(raw['Revenue Decisions']),
				details: optionalText(raw['Revenue Details'])
			}
		},
		economic: {
			summary: optionalText(raw['Economic Rights (Summary)']),
			feeSwitchStatus: raw['Fee Switch Status'],
			feeSwitchDetails: optionalText(raw['Fee Switch Details']),
			links: parseMarkdownLinks(raw['Economic Links'])
		},
		valueAccrual: {
			// The producer writes N/A when a protocol has no primary mechanism.
			primary: primaryValueAccrual === 'N/A' ? null : primaryValueAccrual,
			details: optionalText(raw['Value Accrual Details']),
			buybacks: {
				...parseTokenDisplay(raw.Buybacks),
				details: optionalText(raw['Buyback Details'])
			},
			dividends: {
				...parseTokenDisplay(raw.Dividends),
				details: optionalText(raw['Dividends Details'])
			},
			burns: {
				status: raw.Burns,
				isActive: isActiveStatus(raw.Burns),
				details: optionalText(raw['Burn Details'])
			}
		},
		alignment: {
			fundraising,
			fundraisingLabel: formatList(fundraising),
			raiseDetails: optionalText(raw['Raise Details']),
			associatedEntities: raw['Associated Entities'] ?? [],
			equityRevenueCapture: optionalText(raw['Equity Revenue Capture']),
			equityStatement: optionalText(raw['Equity Statement']),
			ipAndBrand: optionalText(raw['IP & Brand']),
			domain: optionalText(raw.Domain),
			links: parseMarkdownLinks(raw['Ownership Links'])
		},
		resources: {
			addresses: parseAddresses(raw['Foundation Multisigs / Addresses']),
			reports: parseMarkdownLinks(raw['Latest Treasury / Token Report'])
		}
	}
}
