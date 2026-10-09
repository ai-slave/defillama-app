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

export type ProtocolEmissionResultMeta = Pick<
	ProtocolEmission,
	'gecko_id' | 'circSupply' | 'maxSupply' | 'totalLocked' | 'mcap'
>

interface ProtocolEmissionResultFields {
	chartData: { documented: Array<EmissionsChartRow>; realtime: Array<EmissionsChartRow> }
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
	notes: Array<string>
	events: Array<EmissionEvent>
	geckoId: string | null
	upcomingEvent: Array<EmissionEvent>
	tokenAllocation: {
		documented: TokenAllocationSplit
		realtime: TokenAllocationSplit
	}
	futures: { openInterest?: number; fundingRate?: number }
	categories: { documented: Array<string>; realtime: Array<string> }
	categoriesBreakdown: Record<string, Array<string>> | null
	todayLine: {
		documented: Array<[number, string]>
		realtime: Array<[number, string]>
	}
	tokenPrice: { price?: number; symbol?: string }
	unlockUsdChart: Array<TokenIncentiveChartPoint> | null
	tbdSections: Array<string>
	forecastSections: Array<string>
	insiders: { methodology: string; addresses: Array<Insider> }
}

export interface EmptyProtocolEmissionResult extends ProtocolEmissionResultFields {
	meta: null
	name: null
	token: null
}

export interface ResolvedProtocolEmissionResult extends ProtocolEmissionResultFields {
	meta: ProtocolEmissionResultMeta | null
	name: string
	token: string
}

export type ProtocolEmissionResult = EmptyProtocolEmissionResult | ResolvedProtocolEmissionResult
