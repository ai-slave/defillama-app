export type IntegrationStatus = 'full' | 'partial' | 'none' | string

export type PerformanceRow = {
	marketMakerId: string
	marketMakerName: string
	marketMakerImageUrl: string | null
	composite: number | null
	grade: string | null
	tradingKpis: number | null
	trustIntegration: number | null
	coverageCapabilities: number | null
	uptime: number | null
	integrationLevel: number | null
	integrationStatus: IntegrationStatus
	activeEngagementsCount: number | null
	medianEngagementsFdv: number | null
}
