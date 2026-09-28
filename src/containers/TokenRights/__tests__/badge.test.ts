import { describe, expect, test } from 'vitest'
import type { IChainMetadata, IProtocolMetadata } from '~/utils/metadata/types'
import type { TokenDirectory } from '~/utils/tokenDirectory'
import type { IRawTokenRightsEntry } from '../api.types'
import {
	buildRightsById,
	buildRightsRouteById,
	buildUtrSummaryIndex,
	getUtrFacts,
	normalizeTokenRightsId,
	resolveEntityToken,
	type TokenRightsBadgeSources,
	type TokenRightsUtrSummary
} from '../badge'
import type { TokenRightsPreview } from '../types'

function entry(id: string, name: string, lastUpdated?: string): IRawTokenRightsEntry {
	return {
		'Protocol Name': name,
		Token: ['PLUME'],
		'Governance Decisions': ['PLUME'],
		'Treasury Decisions': ['None'],
		'Revenue Decisions': ['None'],
		'Fee Switch Status': 'OFF',
		Dividends: ['None'],
		Burns: 'None',
		...(lastUpdated ? { 'Last Updated': lastUpdated } : {}),
		'DefiLlama ID': id
	}
}

function preview(protocolName: string): TokenRightsPreview {
	return {
		protocolName,
		identityTokens: [],
		utilityItems: [],
		primaryValue: null,
		primaryDetails: null,
		governance: true,
		treasury: true,
		revenue: false,
		buybacks: false,
		dividends: false,
		burns: false,
		equityTone: 'positive'
	}
}

function sources(overrides: Partial<TokenRightsBadgeSources> = {}): TokenRightsBadgeSources {
	return {
		rightsById: new Map([['parent#aave', preview('Aave')]]),
		rightsRouteById: new Map(),
		utrByGeckoId: new Map(),
		protocolMetadata: {
			'parent#aave': { name: 'aave', displayName: 'Aave', gecko_id: 'aave', tokenRights: true },
			'parent#uniswap': { name: 'uniswap', displayName: 'Uniswap', gecko_id: 'uniswap' }
		} satisfies Record<string, IProtocolMetadata>,
		chainMetadata: {
			bitcoincash: { name: 'Bitcoincash', id: 'bitcoincash', gecko_id: 'bitcoin-cash' },
			boba_avax: { name: 'Boba Avax', id: 'boba_avax', gecko_id: 'boba-network' }
		} as unknown as Record<string, IChainMetadata>,
		...overrides
	}
}

describe('buildRightsRouteById', () => {
	test('keys each flagged token page by the rights entry it loads, chain id first', () => {
		const entries = [
			entry('hyperliquid', 'Hyperliquid L1'),
			entry('parent#hyperliquid', 'Hyperliquid'),
			entry('Plume_Mainnet', 'Plume')
		]
		const tokenDirectory: TokenDirectory = {
			hype: {
				name: 'Hyperliquid',
				symbol: 'HYPE',
				chainId: 'hyperliquid',
				protocolId: 'parent#hyperliquid',
				tokenRights: true
			},
			plume: { name: 'Plume', symbol: 'PLUME', chainId: 'Plume_Mainnet', tokenRights: true },
			unflagged: { name: 'Unflagged', symbol: 'UNF', protocolId: 'parent#hyperliquid' }
		}

		// The HYPE page shows the chain entry, so the protocol entry has no page; unflagged pages load no rights.
		expect(buildRightsRouteById(entries, tokenDirectory)).toEqual(
			new Map([
				['hyperliquid', '/token/HYPE'],
				['plume-mainnet', '/token/PLUME']
			])
		)
	})
})

describe('UTR in the badge', () => {
	const utrByGeckoId = buildUtrSummaryIndex([
		{
			coingeckoId: 'Aave',
			notRated: false,
			grade: 'AA',
			disclosureGrade: 'A',
			performanceGrade: 'nope',
			projectName: 'Aave',
			symbol: 'aave',
			overallScore: 72.4,
			disclosureScore: 8.1,
			performanceScore: null,
			momChangePct: -1.5,
			rank: 12,
			tgeStatus: 'post',
			gradedCount: 38,
			criteriaCount: 40,
			asOf: '2026-09-25'
		},
		{ coingeckoId: 'uniswap', notRated: false, grade: 'A' },
		{ coingeckoId: 'bitcoin-cash', notRated: false, grade: 'BB' },
		{ coingeckoId: 'boba-network', notRated: false, grade: 'B' },
		{ coingeckoId: 'pending', notRated: true, grade: 'A' },
		{ coingeckoId: 'ungraded', notRated: false, grade: null }
	])

	test('keeps graded rows keyed by lowercase CoinGecko id, with a rating link and clean grades', () => {
		expect([...utrByGeckoId.keys()].sort()).toEqual(['aave', 'bitcoin-cash', 'boba-network', 'uniswap'])
		expect(utrByGeckoId.get('aave')).toMatchObject({
			href: '/universal-token-rating/token/Aave',
			symbol: 'AAVE',
			performanceGrade: null,
			preTge: false
		})
	})

	test('attaches the grade whether or not the token has published rights', () => {
		expect(resolveEntityToken(sources({ utrByGeckoId }), ['parent#aave'], 'Aave')?.utr?.grade).toBe('AA')
		expect(resolveEntityToken(sources({ utrByGeckoId }), ['parent#uniswap'], 'Uniswap')).toMatchObject({
			rights: null,
			utr: { grade: 'A' }
		})
	})

	test('finds a chain grade when adapter chain ids drift from metadata keys', () => {
		expect(resolveEntityToken(sources({ utrByGeckoId }), ['chain#bitcoin-cash'], 'Bitcoincash')?.utr?.grade).toBe('BB')
		// Metadata keys that keep underscores still match.
		expect(resolveEntityToken(sources({ utrByGeckoId }), ['chain#boba_avax'], 'Other Name')?.utr?.grade).toBe('B')
	})
})

describe('getUtrFacts', () => {
	const utr: TokenRightsUtrSummary = {
		grade: 'AA',
		disclosureGrade: 'A',
		performanceGrade: 'BBB',
		href: '/universal-token-rating/token/aave',
		projectName: 'Aave',
		symbol: 'AAVE',
		score: 72.4,
		disclosureScore: 8.1,
		performanceScore: 6.25,
		momChangePct: 3.2,
		rank: 12,
		preTge: false,
		gradedCount: 38,
		criteriaCount: 40,
		asOf: '2026-09-25'
	}

	test('lists rank within its list and grading coverage', () => {
		expect(getUtrFacts(utr)).toEqual(['#12 among listed tokens', '38 of 40 criteria graded'])
		expect(getUtrFacts({ ...utr, preTge: true })[0]).toBe('#12 among pre-TGE tokens')
	})

	test('leaves out facts the rating does not have', () => {
		expect(getUtrFacts({ ...utr, rank: null, gradedCount: 0, criteriaCount: null })).toEqual([])
	})
})

describe('normalizeTokenRightsId', () => {
	test('matches underscore, hyphen and chain-prefixed spellings', () => {
		expect(normalizeTokenRightsId('plume_mainnet')).toBe('plume-mainnet')
		expect(normalizeTokenRightsId('chain#plume-mainnet')).toBe('plume-mainnet')
		expect(normalizeTokenRightsId('parent#aave')).toBe('parent#aave')
	})
})

describe('buildRightsById', () => {
	test('keeps the most recently updated entry when ids normalize alike, in any order', () => {
		const older = entry('plume_mainnet', 'Plume old', '2026-05-01T00:00:00.000Z')
		const newer = entry('plume-mainnet', 'Plume new', '2026-09-01T00:00:00.000Z')
		expect(buildRightsById([older, newer]).get('plume-mainnet')?.protocolName).toBe('Plume new')
		expect(buildRightsById([newer, older]).get('plume-mainnet')?.protocolName).toBe('Plume new')
	})

	test('keeps the first entry when neither has a date, and skips entries without an id', () => {
		const rights = buildRightsById([entry('aave', 'First'), entry('AAVE', 'Second'), entry('', 'No id')])
		expect(rights.get('aave')?.protocolName).toBe('First')
		expect(rights.size).toBe(1)
	})
})
