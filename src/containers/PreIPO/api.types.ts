export type PreIpoSnapshot<T> = {
	updatedAt: string
	data: T
}

export type PreIpoCompanyListItem = {
	id: string
	name: string
	description: string
	website: string
	sector: string
	latestEstimatedValuation: number | null
	latestRaise: number | null
	latestFundingValuation: number | null
	latestFundingDate: string | null
	lastValuationDate: string | null
	totalRaised: number | null
	valuationChange1YPercentage: number | null
	premiumVsLatestFundingPercentage: number | null
}

export type PreIpoValuation = {
	date: string
	estimatedValuation: number
}

export type PreIpoRaise = {
	date: string
	amountRaised: number
	valuation: number | null
	series: string
}

export type PreIpoCompanySummary = {
	id: string
	name: string
	description: string
	summary: string
	website: string
	sector: string
	latestEstimatedValuation: number | null
	lastValuationDate: string | null
	latestRaise: PreIpoRaise | null
}

type PreIpoPerpExchangeType = 'CEX' | 'DEX'

export type PreIpoPerpIntegration = {
	exchangeName: string
	platformSlug: string
	defillamaContract: string
	exchangeType: PreIpoPerpExchangeType
	openInterest: number | null
	volume: number | null
	price: number
	annualizedFundingRate: number | null
	tradeUrl: string
	estimatedValuation: number | null
}

type PreIpoTokenIssuerBacking = 'Direct shares' | 'Trust-held SPV' | 'SPV interest' | 'Unsecured note' | 'Synthetic'

export type PreIpoTokenIssuerIntegration = {
	issuerName: string
	slug: string | null
	backing: PreIpoTokenIssuerBacking
	productUrl: string
	price: number
	marketCap: number | null
	estimatedValuation: number | null
}

export type PreIpoIntegrations = {
	perps: Array<PreIpoPerpIntegration>
	tokenIssuers: Array<PreIpoTokenIssuerIntegration>
}
