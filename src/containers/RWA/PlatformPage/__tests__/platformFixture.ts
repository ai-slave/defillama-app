import type { RWAStatsSegmented } from '../../api.types'
import type { RWAPlatformMeta } from '../api.types'

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
	onchainAum: 1000,
	estAnnualRevenueUsd: null
}

export function meta(overrides: Partial<RWAPlatformMeta>): RWAPlatformMeta {
	return { ...baseMeta, ...overrides }
}

export function segmented(baseAssets: number, stablecoinAssets: number, governanceAssets = 0): RWAStatsSegmented {
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
