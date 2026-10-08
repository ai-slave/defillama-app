import { chartColor } from '~/constants/colors'
import { readInvestorApiJson } from '../../api.types'

interface DuneResponse<T> {
	result: {
		rows: Array<T>
		metadata: {
			column_names: Array<string>
			column_types: Array<string>
			total_row_count: number
		}
	}
}

export async function fetchDuneQuery<T>(queryId: string): Promise<DuneResponse<T>> {
	const response = await fetch(`/api/public/dune/query/${queryId}`)
	if (!response.ok) throw new Error(`Dune API error: ${response.status}`)
	return readInvestorApiJson<DuneResponse<T>>(response)
}

/** Palette colours by name in alphabetical order, so a name keeps its colour on every chart of the dashboard. */
export function assignColors(names: Array<string>): Record<string, string> {
	const colors: Record<string, string> = {}
	const sorted = names.toSorted()
	for (let i = 0; i < sorted.length; i++) colors[sorted[i]] = chartColor(i)
	return colors
}
