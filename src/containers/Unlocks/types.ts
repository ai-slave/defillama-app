import type {
	EmissionsDataset,
	EmissionsChartRow,
	EmissionsChartConfig,
	EmissionEvent,
	Insider,
	ProtocolEmission,
	TokenAllocationSplit,
	TokenIncentiveChartPoint
} from './api.types'

interface ProtocolEmissionResultFields {
	chartData: { documented: EmissionsChartRow[]; realtime: EmissionsChartRow[] }
	pieChartData: {
		documented: Array<{ name: string; value: number }>
		realtime: Array<{ name: string; value: number }>
	}
	stackColors: {
		documented: Record<string, string>
		realtime: Record<string, string>
	}
	datasets: { documented: EmissionsDataset; realtime: EmissionsDataset }
	chartsConfigs: {
		documented: EmissionsChartConfig
		realtime: EmissionsChartConfig
	}
	notes: string[]
	events: EmissionEvent[]
	geckoId: string | null
	upcomingEvent: EmissionEvent[]
	tokenAllocation: {
		documented: TokenAllocationSplit
		realtime: TokenAllocationSplit
	}
	futures: { openInterest?: number; fundingRate?: number }
	categories: { documented: string[]; realtime: string[] }
	categoriesBreakdown: Record<string, string[]> | null
	hallmarks: {
		documented: Array<[number, string]>
		realtime: Array<[number, string]>
	}
	tokenPrice: { price?: number; symbol?: string }
	unlockUsdChart: TokenIncentiveChartPoint[] | null
	tbdSections: string[]
	forecastSections: string[]
	insiders: { methodology: string; addresses: Insider[] }
}

export interface EmptyProtocolEmissionResult extends ProtocolEmissionResultFields {
	meta: null
	name: null
	token: null
}

export interface ResolvedProtocolEmissionResult extends ProtocolEmissionResultFields {
	meta: ProtocolEmission | null
	name: string
	token: string
}

export type ProtocolEmissionResult = EmptyProtocolEmissionResult | ResolvedProtocolEmissionResult
