import { describe, expect, it } from 'vitest'
import type { RWAStatsSegmented } from '../api.types'
import type { RWAPlatformsIndex, RWAPlatformMeta } from './api.types'
import {
	buildRWAPlatformAssetSummary,
	buildRWAPlatformPageData,
	buildRWAPlatformPeerRows,
	type RWAPlatformCurrentAsset
} from './buildPlatformPageData'

const baseMeta: RWAPlatformMeta = {
	pid: 1,
	protocolSlug: null,
	name: 'Selected',
	slug: 'selected',
	description: null,
	logo: null,
	category: null,
	platformType: null,
	accessModel: null,
	primaryChain: null,
	chain: null,
	chains: [],
	parentPlatform: null,
	website: null,
	twitter: null,
	docs: null,
	linkedin: null,
	discord: null,
	telegram: null,
	rwaGithub: null,
	refLinks: null,
	issuer: null,
	issuerSourceLink: null,
	issuerRegistryInfo: null,
	foundedYear: null,
	headquarters: null,
	founders: null,
	foundersParsed: [],
	regulatoryStatus: null,
	keyMilestones: null,
	milestones: [],
	entityStructureNotes: null,
	delisted: null,
	suspicious: null,
	suspiciousReason: null,
	oracleProvider: null,
	oracleProofLink: null,
	attestationLinks: null,
	dateOfLastAttestation: null,
	attestationFrequency: null,
	llamaGradeAttestation: null,
	revenueModel: null,
	holderTotalFeeBps: null,
	assetManagerTakeBps: null,
	tokenizationPlatformTakeBps: null,
	performanceFeePct: null,
	yieldSpreadRetainedBps: null,
	mintFeeBps: null,
	redemptionFeeBps: null,
	underlyingFundExpenseBps: null,
	floatIncome: null,
	platformSetupFeeUsd: null,
	platformRecurringServiceFeeUsdPerYr: null,
	perpMakerFeeBps: null,
	perpTakerFeeBps: null,
	perpFundingRetentionPct: null,
	prospectusUrl: null,
	feeScheduleUrl: null,
	issuerDocsUrl: null,
	tcsUrl: null,
	governanceWhitepaperUrl: null,
	revenueConfidence: null,
	feeLastVerified: null,
	feeWaiverEndDate: null,
	revenueNotes: null,
	revenueVerificationMethod: null,
	chainShareClassFeeVariants: null,
	subsidyRebateArrangements: null,
	takeRateBasis: null,
	revenueMix: null,
	marginSettlementAsset: null,
	onchainAum: 1_000,
	estAnnualRevenueUsd: null
}

function meta(overrides: Partial<RWAPlatformMeta>): RWAPlatformMeta {
	return { ...baseMeta, ...overrides }
}

function segmented(baseAssets: number, stablecoinAssets: number, governanceAssets = 0): RWAStatsSegmented {
	const slice = (assetCount: number) => ({
		onChainMcap: 0,
		activeMcap: 0,
		defiActiveTvl: 0,
		assetCount,
		assetIssuers: []
	})
	return {
		base: slice(baseAssets),
		stablecoinsOnly: slice(stablecoinAssets),
		governanceOnly: slice(governanceAssets),
		stablecoinsAndGovernance: slice(0)
	}
}

describe('buildRWAPlatformPageData', () => {
	it('uses raw spot assets including stablecoins and RWA Perps categories while excluding governance', () => {
		const selected = meta({})
		const assets: RWAPlatformCurrentAsset[] = [
			{
				parentPlatform: 'Selected',
				governance: false,
				attestations: true,
				defiActiveTvl: { Ethereum: { Aave: 100 } },
				category: ['Stablecoins', 'Other'],
				assetClass: ['Cash', 'Cash'],
				chain: ['Ethereum', 'Ethereum'],
				accessModel: 'Permissionless'
			},
			{
				parentPlatform: 'Selected',
				governance: false,
				attestations: null,
				defiActiveTvl: { Ethereum: { Aave: 50 } },
				category: ['Treasuries'],
				assetClass: ['Debt'],
				chain: ['Ethereum', 'Solana'],
				accessModel: 'Permissioned'
			},
			{
				parentPlatform: 'Selected',
				governance: false,
				attestations: true,
				defiActiveTvl: { Hyperliquid: { CoreWriter: 25 } },
				category: ['RWA Perps'],
				assetClass: ['Synthetic'],
				chain: ['Hyperliquid'],
				accessModel: 'Permissionless'
			},
			{
				parentPlatform: 'Selected',
				governance: true,
				attestations: true,
				defiActiveTvl: { Base: { Aave: 999 } },
				category: ['Governance'],
				assetClass: ['Token'],
				chain: ['Base'],
				accessModel: 'Permissionless'
			},
			{
				parentPlatform: 'Other',
				governance: false,
				attestations: true,
				defiActiveTvl: { Ethereum: { Aave: 999 } },
				category: ['Treasuries'],
				assetClass: ['Debt'],
				chain: ['Ethereum'],
				accessModel: 'Permissioned'
			}
		]
		const assetSummary = buildRWAPlatformAssetSummary(assets, 'selected')

		const result = buildRWAPlatformPageData({
			meta: selected,
			assetSummary
		})

		expect(result.assetCount).toBe(3)
		expect(result.chainCount).toBe(3)
		expect(result.attestedAssetCount).toBe(2)
		expect(result.defiActiveTvl).toBe(175)
		expect(result.defiActiveTvlToAumPct).toBe(17.5)
		expect(result.categoryMix).toEqual([
			{ name: 'RWA Perps', count: 1 },
			{ name: 'Stablecoins', count: 1 },
			{ name: 'Treasuries', count: 1 }
		])
		expect(result.assetClassMix).toEqual([
			{ name: 'Cash', count: 1 },
			{ name: 'Debt', count: 1 },
			{ name: 'Synthetic', count: 1 }
		])
		expect(result.chainMix).toEqual([
			{ name: 'Ethereum', count: 2 },
			{ name: 'Hyperliquid', count: 1 },
			{ name: 'Solana', count: 1 }
		])
	})

	it('ranks active platform metadata by AUM and joins spot asset counts', () => {
		const selected = meta({
			holderTotalFeeBps: 0,
			mintFeeBps: 5,
			redemptionFeeBps: 0
		})
		const larger = meta({
			pid: 2,
			name: 'Larger',
			slug: 'larger',
			onchainAum: 2_000
		})
		const platformsIndex: RWAPlatformsIndex = {
			generatedAt: 1,
			byPid: { '1': 'selected', '2': 'larger' },
			platforms: { selected, larger }
		}

		const peers = buildRWAPlatformPeerRows(platformsIndex, {
			byPlatform: { Selected: segmented(2, 1, 4), Larger: segmented(3, 2) }
		})

		expect(peers.map(({ rank, slug, assetCount }) => ({ rank, slug, assetCount }))).toEqual([
			{ rank: 1, slug: 'larger', assetCount: 5 },
			{ rank: 2, slug: 'selected', assetCount: 3 }
		])
		expect(peers[1]?.holderTotalFeeBps).toBe(0)
	})

	it('excludes zero AUM platforms while retaining positive AUM peers', () => {
		const positive = meta({ onchainAum: 0.01 })
		const zero = meta({ pid: 2, name: 'Zero', slug: 'zero', onchainAum: 0 })
		const platformsIndex: RWAPlatformsIndex = {
			generatedAt: 1,
			byPid: { '1': 'selected', '2': 'zero' },
			platforms: { selected: positive, zero }
		}

		const peers = buildRWAPlatformPeerRows(platformsIndex, {
			byPlatform: { Selected: segmented(1, 0), Zero: segmented(1, 0) }
		})

		expect(peers.map(({ rank, slug }) => ({ rank, slug }))).toEqual([{ rank: 1, slug: 'selected' }])
	})

	it('keeps zero AUM and returns no ratio instead of dividing by zero', () => {
		const selected = meta({ onchainAum: 0, estAnnualRevenueUsd: 0 })
		const result = buildRWAPlatformPageData({
			meta: selected,
			assetSummary: buildRWAPlatformAssetSummary([], 'selected')
		})

		expect(result.assetCount).toBe(0)
		expect(result.defiActiveTvl).toBe(0)
		expect(result.defiActiveTvlToAumPct).toBeNull()
		expect(result.meta.estAnnualRevenueUsd).toBe(0)
	})
})
