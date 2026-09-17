import { describe, expect, test } from 'vitest'
import type { RWAPlatformMeta } from '../../api.types'
import {
	getRwaAccessSplit,
	getRwaConfidenceTone,
	getRwaDocumentGroups,
	getRwaFeeRows,
	getRwaLeadership,
	getRwaPlatformLinks,
	getRwaPlatformTags,
	getRwaProofGroups,
	getRwaRegulationFacts,
	getRwaRevenueDetails,
	getRwaSourceGroups,
	hasRwaFeesContent,
	hasRwaMilestones,
	hasRwaEntityContent,
	rankRwaPlatformIssuers
} from '../panelData'

const empty = {
	name: 'Ondo',
	slug: 'ondo',
	platformType: null,
	category: null,
	accessModel: null,
	website: null,
	refLinks: null,
	docs: null,
	protocolSlug: null,
	twitter: null,
	linkedin: null,
	discord: null,
	telegram: null,
	rwaGithub: null,
	foundersParsed: [],
	founders: null,
	milestones: [],
	keyMilestones: null
} as unknown as RWAPlatformMeta

function meta(overrides: Partial<RWAPlatformMeta>): RWAPlatformMeta {
	return { ...empty, ...overrides }
}

describe('getRwaPlatformTags', () => {
	test('lists the platform types, the categories and the access model once each', () => {
		expect(
			getRwaPlatformTags(
				meta({ platformType: ['MMF', 'T-Bills'], category: ['Bond & MMF Funds', 'MMF'], accessModel: 'Permissioned' })
			)
		).toEqual(['MMF', 'T-Bills', 'Bond & MMF Funds', 'Permissioned'])
		expect(getRwaPlatformTags(empty)).toEqual([])
	})
})

describe('getRwaPlatformLinks', () => {
	test('prefers the referral links for Website, then Docs and the protocol page, then the socials in order', () => {
		const links = getRwaPlatformLinks(
			meta({
				website: ['https://official.example'],
				refLinks: ['https://referral.example'],
				docs: 'https://docs.example',
				protocolSlug: 'ondo',
				linkedin: 'https://linkedin.example',
				twitter: 'https://x.example'
			})
		)
		expect(links.websites).toEqual(['https://referral.example'])
		expect(links.docs).toBe('https://docs.example')
		expect(links.protocolHref).toBe('/protocol/ondo')
		expect(links.socials.map((social) => social.label)).toEqual(['Twitter', 'LinkedIn'])
	})

	test('reads the official website without a referral, and nothing on an empty meta', () => {
		expect(getRwaPlatformLinks(meta({ website: ['https://official.example'] })).websites).toEqual([
			'https://official.example'
		])
		const none = getRwaPlatformLinks(empty)
		expect(none.websites).toEqual([])
		expect(none.socials).toEqual([])
		expect(none.protocolHref).toBeNull()
	})
})

describe('rankRwaPlatformIssuers', () => {
	test('ranks the issuers by active AUM, keeps five and counts the rest, and is empty for one issuer', () => {
		const issuers = [
			{ name: 'Apollo', value: 5 },
			{ name: 'BlackRock', value: 60 },
			{ name: 'Cosmo', value: 4 },
			{ name: 'Delta', value: 3 },
			{ name: 'Echo', value: 2 },
			{ name: 'Fox', value: 1 },
			{ name: 'Gama', value: 0 }
		]
		expect(rankRwaPlatformIssuers(issuers)).toEqual({
			shown: ['BlackRock', 'Apollo', 'Cosmo', 'Delta', 'Echo'],
			more: 2
		})
		expect(rankRwaPlatformIssuers([{ name: 'Ondo', value: 1 }])).toEqual({ shown: [], more: 0 })
	})
})

describe('fees and revenue', () => {
	test('lists only the fee fields that are set, formatted in their units, the revenue model aside', () => {
		const rows = getRwaFeeRows(
			meta({
				revenueModel: 'Management Fee',
				holderTotalFeeBps: 25,
				mintFeeBps: 0,
				performanceFeePct: 10,
				platformRecurringServiceFeeUsdPerYr: 12_000,
				floatIncome: false,
				feeLastVerified: '2026-05-04',
				estAnnualRevenueUsd: 4_200_000
			})
		)
		expect(rows).toEqual([
			{ label: 'Est. annual revenue', value: '$4.2m', mono: true },
			{ label: 'Holder total fee', value: '25 bps', mono: true },
			{ label: 'Performance fee', value: '10%', mono: true },
			{ label: 'Mint fee', value: '0 bps', mono: true },
			{ label: 'Recurring service fee', value: '$12,000/yr', mono: true },
			{ label: 'Float income', value: 'No', mono: false },
			{ label: 'Fees last verified', value: '2026-05-04', mono: true }
		])
	})

	test('collects the six estimate details and the document groups that are set', () => {
		expect(getRwaRevenueDetails(meta({ takeRateBasis: 'AUM', revenueMix: 'fees' })).map((d) => d.label)).toEqual([
			'Take-rate basis',
			'Revenue mix'
		])
		expect(
			getRwaDocumentGroups(meta({ feeScheduleUrl: ['https://fees.example'], tcsUrl: ['https://a', 'https://b'] }))
		).toEqual([
			{ label: 'Fee schedule', urls: ['https://fees.example'] },
			{ label: 'Terms and conditions', urls: ['https://a', 'https://b'] }
		])
	})

	test('maps the confidence to its tone and knows when the panel has nothing to say', () => {
		expect(getRwaConfidenceTone('Public Filings')).toBe('text-data-up')
		expect(getRwaConfidenceTone('Issuer-Disclosed')).toBe('text-data-up-alt')
		expect(getRwaConfidenceTone('Reasoned Estimate')).toBe('text-warning')
		expect(getRwaConfidenceTone('No-public-data')).toBe('text-tertiary')
		expect(hasRwaFeesContent(empty)).toBe(false)
		expect(hasRwaFeesContent(meta({ revenueNotes: 'Estimated from docs.' }))).toBe(true)
		expect(hasRwaFeesContent(meta({ revenueConfidence: 'No-public-data' }))).toBe(true)
	})
})

describe('compliance', () => {
	test('splits the access models over the assets as counts and a permissionless share', () => {
		expect(getRwaAccessSplit({ permissionlessCount: 3, assetCount: 4 })).toEqual({
			permissionless: 3,
			permissioned: 1,
			total: 4,
			permissionlessPct: 75
		})
		expect(getRwaAccessSplit({ permissionlessCount: 0, assetCount: 0 })).toEqual({
			permissionless: 0,
			permissioned: 0,
			total: 0,
			permissionlessPct: null
		})
	})

	test('keeps the proof links for Compliance and the issuer source for Regulation', () => {
		const withLinks = meta({ attestationLinks: ['https://report.example'], issuerSourceLink: ['https://src'] })
		expect(getRwaProofGroups(withLinks)).toEqual([{ label: 'Attestation report', urls: ['https://report.example'] }])
		expect(getRwaSourceGroups(withLinks)).toEqual([{ label: 'Issuer source', urls: ['https://src'] }])
	})
})

describe('entity', () => {
	test('lists the facts that are set, the leadership from the parsed founders or the text, and knows an empty meta', () => {
		expect(
			getRwaRegulationFacts(
				meta({ issuer: 'Ondo Finance Inc.', headquarters: 'New York', foundedYear: 2021, primaryChain: 'Ethereum' })
			)
		).toEqual([
			{ label: 'Legal entity', value: 'Ondo Finance Inc.' },
			{ label: 'Headquarters', value: 'New York' },
			{ label: 'Founded', value: '2021' },
			{ label: 'Primary chain', value: 'Ethereum' }
		])
		expect(getRwaLeadership(meta({ foundersParsed: [{ name: 'Nathan Allman', role: 'CEO' }] }))).toEqual([
			{ name: 'Nathan Allman', role: 'CEO' }
		])
		expect(getRwaLeadership(meta({ founders: 'Nathan Allman' }))).toEqual([{ name: 'Nathan Allman', role: null }])
		expect(hasRwaEntityContent(empty)).toBe(false)
		expect(hasRwaEntityContent(meta({ regulatoryStatus: 'SEC-registered' }))).toBe(false)
		expect(hasRwaEntityContent(meta({ headquarters: 'New York' }))).toBe(true)
		expect(hasRwaEntityContent(meta({ issuerSourceLink: ['https://src'] }))).toBe(true)
		expect(hasRwaMilestones(empty)).toBe(false)
		expect(hasRwaMilestones(meta({ keyMilestones: '2024: launch' }))).toBe(true)
	})
})
