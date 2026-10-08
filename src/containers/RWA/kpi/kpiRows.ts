import type { CsvPayload } from '~/components/CsvDownloadButton'
import type { RWAPageKind } from '../layout/pageLayout'
import { rwaSlug } from '../rwaSlug'
import { percentChange, type RWAValueWithPrior } from '../table/change'
import { getRwaCsvFileName } from '../table/csv'
import { RWA_KPI_PERIOD_LABEL } from './MetricChange'

/* One Key Metrics card is a headline and a list of rows; the panel draws the list and the csv walks the same list,
   so a row added to a card lands in its csv. */

type RwaKpiValue =
	| { kind: 'usd' | 'ratio' | 'count' | 'turnover'; value: number | null }
	| { kind: 'text'; value: string | null }
	/** A 24h change: the percent in the panel, the dollar change in its tooltip. */
	| { kind: 'change'; change: RWAValueWithPrior; total: number | null }
	/** A name with its value, such as the largest protocol; the csv writes the value on a line of its own. */
	| { kind: 'named'; name: string | null; value: number | null; csvValue: string }

export type RwaKpiRow = {
	label: string
	tooltip?: string
	/** The csv label where it differs from the panel's: a sub row reads "24h", its csv line "Est. Fees (24h)". */
	csv?: string
	value: RwaKpiValue
	/** How the panel prints a value the plain format does not fit ("4.5 bps"). */
	text?: string
	rows?: Array<RwaKpiRow>
}

export type RwaKpiHeadline = {
	label: string
	labelAs: 'h1' | 'h2'
	tooltip: string
	value: number | null
	change: RWAValueWithPrior
	/** The csv labels of the value and of its 24h change: the page h1 is too long for a csv line. */
	csv: { value: string; change: string }
}

function toCsvRows(row: RwaKpiRow): CsvPayload['rows'] {
	const { value } = row
	const label = row.csv ?? row.label
	if (value.kind === 'change') return [[label, percentChange(value.change.current, value.change.prior)]]
	if (value.kind === 'named')
		return [
			[label, value.name],
			[value.csvValue, value.value]
		]
	return [[label, value.value]]
}

/** The csv the button writes: the lead lines, the headline, then every row and sub row as raw values, panel order. */
export function buildRwaKpiCsv({
	filename,
	headline,
	rows,
	lead = []
}: {
	filename: string
	headline: RwaKpiHeadline
	rows: Array<RwaKpiRow>
	lead?: CsvPayload['rows']
}): CsvPayload {
	return {
		filename,
		rows: [
			['Metric', 'Value'],
			...lead,
			[headline.csv.value, headline.value],
			[
				`${headline.csv.change} change (${RWA_KPI_PERIOD_LABEL}) %`,
				percentChange(headline.change.current, headline.change.prior)
			],
			...rows.flatMap((row) => [...toCsvRows(row), ...(row.rows ?? []).flatMap(toCsvRows)])
		]
	}
}

/** The csv name of a page's Key Metrics card, from the page kind and its scope's name. */
export function getRwaKpiCsvName(pageKind: RWAPageKind, scopeName: string | null | undefined): string {
	return getRwaCsvFileName(pageKind, scopeName ? rwaSlug(scopeName) : null, 'key-metrics')
}

export const kpiUsd = (value: number | null) => ({ kind: 'usd' as const, value })
export const kpiCount = (value: number | null) => ({ kind: 'count' as const, value })
/** The DEX share row's tooltip, the same on the Assets and the Perps card. */
export const RWA_DEX_SHARE_TOOLTIP =
	'Open interest on DEX venues as a share of all open interest, over both venue types whatever Venue Type says.'
