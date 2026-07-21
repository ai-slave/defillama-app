import { EXTENDED_COLOR_PALETTE } from '~/containers/ProDashboard/utils/colorManager'
import { readInvestorApiJson } from '../../api.types'

interface DuneResponse<T> {
	result: {
		rows: T[]
		metadata: {
			column_names: string[]
			column_types: string[]
			total_row_count: number
		}
	}
}

export async function fetchDuneQuery<T>(queryId: string): Promise<DuneResponse<T>> {
	const response = await fetch(`/api/public/dune/query/${queryId}`)
	if (!response.ok) throw new Error(`Dune API error: ${response.status}`)
	return readInvestorApiJson<DuneResponse<T>>(response)
}

export function assignColors(names: string[]): Record<string, string> {
	const colors = {}
	const sorted = names.toSorted()
	for (let i = 0; i < sorted.length; i++) {
		colors[sorted[i]] = EXTENDED_COLOR_PALETTE[i % EXTENDED_COLOR_PALETTE.length]
	}
	return colors
}
