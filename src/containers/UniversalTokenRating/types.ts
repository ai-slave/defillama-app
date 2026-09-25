export type UtrMarketMetrics = {
	asOf: string | null
	depthMcapPct: number | null
	depthUsd: number | null
	fdvUsd: number | null
	marketCapUsd: number | null
	mcapFdvRatio: number | null
	volume24hUsd: number | null
	volumeMcapPct: number | null
	vwasBps: number | null
}

export type UtrCandleMetrics = {
	asOf: string | null
	greenCandles30d: number | null
	totalCandles30d: number | null
}

export type UtrDerivativesMetrics = {
	asOf: string | null
	fundingRateBps: number | null
	oiMcapPct: number | null
	openInterestUsd: number | null
	perpVolumeUsd: number | null
}

export type UtrMarketMakerMetrics = {
	asOf: string | null
	mmDepthPct: number | null
	mmDepthUsd: number | null
	mmUptimePct: number | null
	mmVolumePct: number | null
	mmVolumeUsd: number | null
}

export type UtrLiquidityMetrics = {
	asOf: string | null
	cexDepthPct: number | null
	cexVolumePct: number | null
	otherVenues: number | null
	spotDepthPct: number | null
	spotVolumePct: number | null
	tier1Exchanges: Array<string>
	tier2Exchanges: Array<string>
}

export type UtrTokenomicsMetrics = {
	annualizedInflation: number | null
	asOf: string | null
	buybackBurn: number | null
	circulatingSupply: number | null
	maxSupply: number | null
	vestingActualVsDisclosed: number | null
}

export type UtrAssetMetrics = {
	asset: string
	name: string | null
	symbol: string | null
	market: UtrMarketMetrics
	candles: UtrCandleMetrics
	derivatives: UtrDerivativesMetrics
	marketMakers: UtrMarketMakerMetrics
	liquidity: UtrLiquidityMetrics
	tokenomics: UtrTokenomicsMetrics
}

export type UtrBatchResponse = {
	assets: Array<UtrAssetMetrics>
	notFound: Array<string>
}

export type UtrRubricScore = {
	rubric: string
	weighted: number | null
	percentage: number | null
	percentile: number | null
}

export type UtrScores = {
	overall: number | null
	overallMomChangePct: number | null
	disclosure: number | null
	performance: number | null
	rank: number | null
	disclosureRubrics: Array<UtrRubricScore>
	performanceRubrics: Array<UtrRubricScore>
}

export type UtrListingStatus = 'listed' | 'pre-tge' | 'unlisted'

export type UtrDisclosureLevel = 'full' | 'partial' | 'none'

export type UtrLeaderboardRow = {
	asset: string
	name: string
	symbol: string
	sector: string | null
	listingStatus: UtrListingStatus
	disclosureLevel: UtrDisclosureLevel
	claimed: boolean
	fdvUsd: number | null
	scores: UtrScores
	coingeckoId?: string | null
	iconDataUrl?: string | null
	grade?: string | null
	disclosureGrade?: string | null
	performanceGrade?: string | null
	breakdown?: {
		disclosure: Array<UtrCategoryBreakdown>
		performance: Array<UtrCategoryBreakdown>
	}
}

export type UtrUniverse = {
	rows: Array<UtrLeaderboardRow>
	scoredCount: number
	totalCount: number
}

export type UtrProject = {
	arcticId: string
	projectName: string
	symbol: string
	sector: string | null
	tgeStatus: 'pre' | 'post'
	isActive: boolean
	createdAt: string
	updatedAt: string
	coingeckoId: string | null
	cmcId: string | null
	hasData: boolean
}

export type UtrDisclosureScoreSummary = {
	arcticId: string
	gradedCount: number
	criteriaCount: number
	maxScore: number
	disclosureScore: number | null
	scoredAt: string | null
	scoredBy: string | null
}

export type UtrClaimProjectOption = {
	arcticId: string
	projectName: string
	symbol: string
	coingeckoId: string | null
	tgeStatus: 'pre' | 'post'
	disclosureScore: number | null
	gradedCount: number
	criteriaCount: number
}

export type UtrClaimExchangeOption = {
	id: string
	displayName: string
}

export type UtrClaimMarketMakerOption = {
	marketMakerId: string
	marketMakerName: string
}

export type UtrTopMover = {
	asset: string
	name: string
	momChangePct: number
	logoUrl?: string | null
}

export type UtrMomResponse = {
	configVersion: number
	generatedAt: string
	rows: Array<{ projectName: string; logoUrl: string | null; momChangePct: number | null }>
}

export type UtrCriterionBreakdown = {
	key: string
	label: string
	weight: number
	raw?: number | null
	score: number
	grade: string | null
	percentile: number | null
	note: string | null
	scoredAt?: string | null
}

export type UtrCategoryBreakdown = {
	key: string
	label: string
	score: number
	grade: string
	percentile: number
	criteria: Array<UtrCriterionBreakdown>
}

export type UtrAxisBreakdown = {
	score: number
	grade: string
	momChangePct?: number | null
	categories: Array<UtrCategoryBreakdown>
}

export type UtrChartSummary = {
	criterionKey: string
	score?: number | null
	grade?: string | null
	percentile?: number | null
	avgUsd?: number | null
	avgMarketCapUsd?: number | null
	ratioPct?: number | null
}

export type UtrMarketSeriesPoint = {
	date: string
	marketCapUsd: number | null
	tradeVolumeUsd: number | null
	depthUsd: number | null
}

export type UtrMarketQualityCharts = {
	windowDays: number
	series: Array<UtrMarketSeriesPoint>
	volumeMcap: UtrChartSummary
	depthMcap: UtrChartSummary
}

export type UtrCandlePoint = {
	date: string
	openUsd: number
	highUsd: number
	lowUsd: number
	closeUsd: number
}

export type UtrPricePerformanceChart = {
	windowDays: number
	candles: Array<UtrCandlePoint>
	changePct: number | null
	greenCandles: number
	redCandles: number
	winRatePct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrOpenInterestChart = {
	windowDays: number
	venues: Array<{ exchangeId: string; avgOiUsd: number }>
	totalOiUsd: number | null
	oiMcapRatioPct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrFundingRateChart = {
	windowDays: number
	exchanges: Array<{ exchangeId: string; points: Array<{ date: string; fundingPct: number | null }> }>
	oiWeightedFundingPct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrBidAskSpreadChart = {
	windowDays: number
	exchanges: Array<{ exchangeId: string; points: Array<{ date: string; spreadPct: number | null }> }>
	tightestExchange: string | null
	vwasPct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrCexDexChart = {
	windowDays: number
	points: Array<{ date: string; cexUsd: number | null; dexUsd: number | null }>
	cexAvgUsd: number | null
	dexAvgUsd: number | null
	cexSharePct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrSpotPerpChart = {
	windowDays: number
	points: Array<{ date: string; spotUsd: number | null; perpsUsd: number | null }>
	spotAvgUsd: number | null
	perpsAvgUsd: number | null
	spotSharePct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrAssetCharts = {
	marketQuality: UtrMarketQualityCharts | null
	pricePerformance: UtrPricePerformanceChart | null
	bidAskSpread: UtrBidAskSpreadChart | null
	openInterest: UtrOpenInterestChart | null
	fundingRate: UtrFundingRateChart | null
	cexVsDexVolume: UtrCexDexChart | null
	cexVsDexDepth: UtrCexDexChart | null
	spotVsPerpsVolume: UtrSpotPerpChart | null
	spotVsPerpsDepth: UtrSpotPerpChart | null
}

export type UtrSnapshotMetrics = {
	marketCapUsd: number | null
	fdvUsd: number | null
	spotVolume24hUsd: number | null
	cexVolume24hUsd: number | null
	dexVolume24hUsd: number | null
	spotDepthUsd: number | null
	cexDepthUsd: number | null
	dexDepthUsd: number | null
	vwasBps: number | null
	greenCandles30d: number | null
	totalCandles30d: number | null
	maxGreenStreak30d: number | null
	openInterestUsd: number | null
	fundingRateBps: number | null
	perpVolume24hUsd: number | null
	perpDepthUsd: number | null
	mmVolumePct: number | null
	mmDepthPct: number | null
	mmUptimePct: number | null
	tier1VenueCount: number
	tier2VenueCount: number
	tier3VenueCount: number
	dexVenueCount: number
	annualizedInflationPct: number | null
	releasedSupplyTokens: number | null
	cumulativeBuybackTokens: number | null
	cumulativeBurnTokens: number | null
	vestingAmountVariancePct: number | null
	vestingTimingVarianceDays: number | null
	undisclosedUnlockDetected: boolean
	hasVestingDisclosure: boolean
}

export type UtrMarketMakerProvider = {
	name: string
	engagementType?: string | null
	avgFillVolumeTotal?: number | null
	avgBidAskDepth50?: number | null
	avgBidAskDepth100?: number | null
	avgBidAskDepth200?: number | null
	avgSpread?: number | null
	percentageOfTotalVolume?: number | null
	percentageOfTotalLiquidity?: number | null
	activeEngagementsCount?: number | null
}

export type UtrMarketMakerDailyBreakdown = {
	date: string
	marketMakers: number | null
	allOthers: number | null
	total: number | null
	marketMakersPercentage: number | null
	allOthersPercentage: number | null
	hasMarketTotals?: boolean
}

export type UtrMarketMakerSeries = {
	name: string
	avgValue: number | null
	avgPercentage: number | null
	dailyBreakdown: Array<{ date: string; value: number | null; percentage: number | null }>
}

export type UtrMarketMakerBreakdownMetric = {
	avgBreakdown: {
		marketMakers: number | null
		allOthers: number | null
		total: number | null
		marketMakersPercentage: number | null
		allOthersPercentage: number | null
	}
	dailyBreakdown: Array<UtrMarketMakerDailyBreakdown>
	isOverreporting?: boolean
	series: Array<UtrMarketMakerSeries>
}

export type UtrMarketMakerPerformanceBreakdown = {
	depth?: Partial<
		Record<
			'bidAsk' | 'bid' | 'ask',
			Partial<Record<'depth50' | 'depth100' | 'depth200', UtrMarketMakerBreakdownMetric>>
		>
	>
	volume?: Partial<Record<'total' | 'maker' | 'taker', UtrMarketMakerBreakdownMetric>>
}

export type UtrMarketMakerUptime = {
	name: string
	engagementType?: string | null
	kpiEngagementType?: string | null
	uptimeObligation?: number | null
	performance?: {
		avgBidAskSpread?: number | null
		avgDepth50?: number | null
		avgDepth100?: number | null
		avgDepth200?: number | null
		avgUptime?: number | null
	} | null
	breakdown?: Array<{
		date: string
		reportedDepth50?: number | null
		reportedDepth100?: number | null
		reportedDepth200?: number | null
		reportedSpread?: number | null
		targetDepth50?: number | null
		targetDepth100?: number | null
		targetDepth200?: number | null
		targetSpread?: number | null
		achievedDepth50?: boolean | null
		achievedDepth100?: boolean | null
		achievedDepth200?: boolean | null
		achievedSpread?: boolean | null
		uptimeRatio?: number | null
	}>
}

export type UtrLeaderboardApiRow = {
	rank: number | null
	arcticId: string
	projectName: string
	symbol: string
	sector: string | null
	tgeStatus: string
	coingeckoId: string | null
	cmcId: string | null
	notRated: boolean
	grade: string | null
	disclosureGrade?: string | null
	performanceGrade?: string | null
	overallScore: number | null
	momChangePct: number | null
	disclosureScore: number | null
	performanceScore: number | null
	fdvUsd: number | null
	asOf: string | null
	gradedCount: number
	criteriaCount: number
	disclosureCategories: Array<UtrCategoryBreakdown>
	performanceCategories: Array<UtrCategoryBreakdown>
}

export type UtrLeaderboardResponse = {
	configVersion: number
	generatedAt: string
	scoredCount: number
	totalCount: number
	postTge: { rows: Array<UtrLeaderboardApiRow> }
	preTge: { rows: Array<UtrLeaderboardApiRow> }
}

export type UtrLeaderboardTableApiRow = {
	rank: number | null
	asset: string
	coingeckoId: string | null
	projectName: string
	symbol: string
	sector: string | null
	listingStatus: UtrListingStatus
	grade: string | null
	overallScore: number | null
	overallMomChangePct: number | null
	disclosureScore: number | null
	performanceScore: number | null
	fdvUsd: number | null
}

export type UtrLeaderboardTableApiResponse = {
	configVersion: number
	generatedAt: string
	scoredCount: number
	totalCount: number
	rows: Array<UtrLeaderboardTableApiRow>
}

export type UtrCriterionDoc = {
	key: string
	label: string
	definition: string | null
	rubric: Array<string>
}

export type UtrCategoryDoc = {
	key: string
	label: string
	criteria: Array<UtrCriterionDoc>
}

export type UtrScoringDocs = {
	disclosure: Array<UtrCategoryDoc>
	performance: Array<UtrCategoryDoc>
}

export type UtrGradeScaleEntry = {
	min: number | null
	grade: string
	interpretation: string
}

export type UtrGradingAxisConfig = {
	description: string
	scale: Array<UtrGradeScaleEntry>
}

export type UtrGradingConfig = {
	overall: UtrGradingAxisConfig
	disclosure: UtrGradingAxisConfig
	performance: UtrGradingAxisConfig
}

export type UtrCriterionApplicability = 'both' | 'preTge' | 'postTge'

export type UtrScoringCriterionConfig = UtrCriterionDoc & {
	weight: number
	applicability: UtrCriterionApplicability
	evaluationType: string | null
	ignoreBlacklistedExchanges: boolean | null
	expression: string | null
	bands: Array<unknown>
}

export type UtrScoringCategoryConfig = {
	key: string
	label: string
	criteria: Array<UtrScoringCriterionConfig>
}

export type UtrScoringExchange = {
	id: string
	displayName: string
	logoUrl: string | null
}

export type UtrScoringConfig = {
	version: number
	grading: UtrGradingConfig
	disclosure: { categories: Array<UtrScoringCategoryConfig> }
	performance: { categories: Array<UtrScoringCategoryConfig> }
	exchanges: {
		tier1: Array<UtrScoringExchange>
		tier2: Array<UtrScoringExchange>
	}
}

export type UtrExchangeVenue = {
	name: string
	displayName: string
	logoUrl: string | null
}

export type UtrExchangesResponse = {
	arcticId: string
	symbol: string
	asOf: string | null
	configVersion: number
	tiers: Array<{ tier: string; exchanges: Array<UtrExchangeVenue> }>
}

export type UtrAssetResponse = {
	arcticId: string
	defillamaId?: string | null
	projectName: string
	symbol: string
	sector: string | null
	tgeStatus: string
	coingeckoId: string | null
	cmcId: string | null
	description?: string | null
	websiteUrl?: string | null
	chain?: string | null
	logoUrl?: string | null
	hasMmData?: boolean
	hasFundraising?: boolean
	lastRound?: string | null
	notRated: boolean
	rank: number | null
	ratedCount: number
	totalCount: number
	overallScore: number | null
	overallPercentile?: number | null
	dataStatus?: 'ready' | 'pending' | 'stale'
	grade: string | null
	momChangePct: number | null
	fdvUsd: number | null
	asOf: string | null
	lastEditedAt: string | null
	gradedCount: number
	criteriaCount: number
	configVersion: number
	generatedAt: string
	disclosure: UtrAxisBreakdown | null
	performance: UtrAxisBreakdown | null
	metrics: UtrSnapshotMetrics | null
	charts: UtrAssetCharts
	marketMakers?: Array<UtrMarketMakerProvider>
	performanceBreakdown?: UtrMarketMakerPerformanceBreakdown | null
	uptimeCalculations?: Array<UtrMarketMakerUptime>
}

export type UtrDisclosedAllocation = number | string | null

export type UtrDisclosedTokenomicsGroup = {
	groupName: string
	allocationPct: number
	groupCategory: string
	tgeUnlockPct: number
	lockUpDurationMonths: number
	cliffUnlockPct: number
	unlockDurationMonths: number
	unlockFrequency: string
}

export type UtrDisclosures = {
	updatedAt: string | null
	insiderIdentities: Array<{ name: string; role: string; profileUrl: string | null; description: string | null }>
	organizationalStructure: Array<{ companyName: string; jurisdiction: string; description: string }>
	insiderWallets: Array<{ walletAddress: string; allocationPct: UtrDisclosedAllocation; ownerType: string }>
	tokenomicsGroups: Array<UtrDisclosedTokenomicsGroup>
	externalAllocations: Array<{
		counterpartyName: string
		allocationPct: UtrDisclosedAllocation
		categorization: string
	}>
	multisigWallets: Array<{ walletAddress: string; thresholdRequired: number | null; thresholdTotal: number | null }>
	licenses: Array<{ name: string; link: string | null; description: string }>
	marketMakerEngagements: Array<{
		marketMakerName: string
		logoUrl: string | null
		allocationPct: UtrDisclosedAllocation
		engagementType: string
	}>
	verifyMmEngagements: boolean | null
	exchangeEngagements: Array<{
		exchangeName: string
		logoUrl: string | null
		commercialCommitment: boolean | null
		details: string | null
	}>
	auditors: Array<{ name: string; type: string; link: string | null }>
	roleDescriptionsCommentary: string | null
	treasuryReportingCommentary: string | null
	cashFlowCommentary: string | null
	vestingActualCommentary: string | null
}
