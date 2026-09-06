export interface EmissionsBreakdownProtocol {
	name: string
	defillamaId: string
	linked: Array<string>
	category: string
	chain: string
	emission24h: number | null
	emission7d: number
	emission30d: number
	emissions1y: number
	emissionsAllTime: number
	emissionsAverage1y: number
	emissionsMonthlyAverage1y: number | null
}

export interface EmissionsBreakdownAggregatedResponse {
	protocols: Array<EmissionsBreakdownProtocol>
	emission24h: number
	emission7d: number
	emission30d: number
	emissionsMonthlyAverage1y: number
}
