export type RWAPlatformRevenueConfidence =
	| 'No-public-data'
	| 'Reasoned Estimate'
	| 'Issuer-Disclosed'
	| 'Public Filings'

export interface RWAPlatformMilestone {
	date: string | null
	event: string
}

export interface RWAPlatformFounder {
	name: string
	role: string | null
}

export interface RWAPlatformMeta {
	pid: number | null
	protocolSlug: string | null
	name: string
	slug: string
	description: string | null
	logo: string | null
	category: Array<string> | null
	platformType: Array<string> | null
	accessModel: string | null
	primaryChain: string | null
	chain: Array<string> | null
	chains: Array<string>
	parentPlatform: string | null
	website: Array<string> | null
	twitter: string | null
	docs: string | null
	linkedin: string | null
	discord: string | null
	telegram: string | null
	rwaGithub: string | null
	refLinks: Array<string> | null
	issuer: string | null
	issuerSourceLink: Array<string> | null
	issuerRegistryInfo: string | null
	foundedYear: number | null
	headquarters: string | null
	founders: string | null
	foundersParsed: Array<RWAPlatformFounder>
	regulatoryStatus: string | null
	keyMilestones: string | null
	milestones: Array<RWAPlatformMilestone>
	entityStructureNotes: string | null
	delisted: boolean | null
	suspicious: boolean | null
	suspiciousReason: string | null
	oracleProvider: string | null
	oracleProofLink: Array<string> | null
	attestationLinks: Array<string> | null
	dateOfLastAttestation: string | null
	attestationFrequency: string | null
	llamaGradeAttestation: boolean | null
	revenueModel: string | null
	holderTotalFeeBps: number | null
	assetManagerTakeBps: number | null
	tokenizationPlatformTakeBps: number | null
	performanceFeePct: number | null
	yieldSpreadRetainedBps: number | null
	mintFeeBps: number | null
	redemptionFeeBps: number | null
	underlyingFundExpenseBps: number | null
	floatIncome: boolean | null
	platformSetupFeeUsd: number | null
	platformRecurringServiceFeeUsdPerYr: number | null
	perpMakerFeeBps: number | null
	perpTakerFeeBps: number | null
	perpFundingRetentionPct: number | null
	prospectusUrl: Array<string> | null
	feeScheduleUrl: Array<string> | null
	issuerDocsUrl: Array<string> | null
	tcsUrl: Array<string> | null
	governanceWhitepaperUrl: Array<string> | null
	revenueConfidence: RWAPlatformRevenueConfidence | null
	feeLastVerified: string | null
	feeWaiverEndDate: string | null
	revenueNotes: string | null
	revenueVerificationMethod: string | null
	chainShareClassFeeVariants: string | null
	subsidyRebateArrangements: string | null
	takeRateBasis: string | null
	revenueMix: string | null
	marginSettlementAsset: Array<string> | null
	onchainAum: number
	estAnnualRevenueUsd: number | null
}

export interface RWAPlatformsIndex {
	generatedAt: number
	byPid: Record<string, string>
	// TVL protocol slug -> platform slug, RWA-category protocols only. Optional: artifacts
	// published before the map existed omit it.
	byProtocolSlug?: Record<string, string>
	platforms: Record<string, RWAPlatformMeta>
}
