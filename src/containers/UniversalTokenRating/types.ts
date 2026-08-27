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
	tier1Exchanges: string[]
	tier2Exchanges: string[]
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
	assets: UtrAssetMetrics[]
	notFound: string[]
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
	disclosureRubrics: UtrRubricScore[]
	performanceRubrics: UtrRubricScore[]
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
		disclosure: UtrCategoryBreakdown[]
		performance: UtrCategoryBreakdown[]
	}
}

export type UtrUniverse = {
	rows: UtrLeaderboardRow[]
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
	tgeStatus: 'pre' | 'post'
	disclosureScore: number | null
	gradedCount: number
	criteriaCount: number
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
	rows: { projectName: string; logoUrl: string | null; momChangePct: number | null }[]
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
	criteria: UtrCriterionBreakdown[]
}

export type UtrAxisBreakdown = {
	score: number
	grade: string
	momChangePct?: number | null
	categories: UtrCategoryBreakdown[]
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
	series: UtrMarketSeriesPoint[]
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
	candles: UtrCandlePoint[]
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
	venues: { exchangeId: string; avgOiUsd: number }[]
	totalOiUsd: number | null
	oiMcapRatioPct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrFundingRateChart = {
	windowDays: number
	exchanges: { exchangeId: string; points: { date: string; fundingPct: number | null }[] }[]
	oiWeightedFundingPct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrBidAskSpreadChart = {
	windowDays: number
	exchanges: { exchangeId: string; points: { date: string; spreadPct: number | null }[] }[]
	tightestExchange: string | null
	vwasPct: number | null
	criterionKey: string
	score: number | null
	grade: string | null
	percentile: number | null
}

export type UtrCexDexChart = {
	windowDays: number
	points: { date: string; cexUsd: number | null; dexUsd: number | null }[]
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
	points: { date: string; spotUsd: number | null; perpsUsd: number | null }[]
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
	disclosureCategories: UtrCategoryBreakdown[]
	performanceCategories: UtrCategoryBreakdown[]
}

export type UtrLeaderboardResponse = {
	configVersion: number
	generatedAt: string
	scoredCount: number
	totalCount: number
	postTge: { rows: UtrLeaderboardApiRow[] }
	preTge: { rows: UtrLeaderboardApiRow[] }
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
	rows: UtrLeaderboardTableApiRow[]
}

export type UtrCriterionDoc = {
	key: string
	label: string
	definition: string | null
	rubric: string[]
}

export type UtrCategoryDoc = {
	key: string
	label: string
	criteria: UtrCriterionDoc[]
}

export type UtrScoringDocs = {
	disclosure: UtrCategoryDoc[]
	performance: UtrCategoryDoc[]
}

export type UtrGradeScaleEntry = {
	min: number | null
	grade: string
	interpretation: string
}

export type UtrGradingAxisConfig = {
	description: string
	scale: UtrGradeScaleEntry[]
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
	bands: unknown[]
}

export type UtrScoringCategoryConfig = {
	key: string
	label: string
	criteria: UtrScoringCriterionConfig[]
}

export type UtrScoringExchange = {
	id: string
	displayName: string
	logoUrl: string | null
}

export type UtrScoringConfig = {
	version: number
	grading: UtrGradingConfig
	disclosure: { categories: UtrScoringCategoryConfig[] }
	performance: { categories: UtrScoringCategoryConfig[] }
	exchanges: {
		tier1: UtrScoringExchange[]
		tier2: UtrScoringExchange[]
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
	tiers: { tier: string; exchanges: UtrExchangeVenue[] }[]
}

export type UtrAssetResponse = {
	arcticId: string
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
}
