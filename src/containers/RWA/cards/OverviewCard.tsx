import { TokenLogo } from '~/components/TokenLogo'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { formatRwaKpiUsd } from '../kpi/format'
import type { RwaChangeBar, RwaNamedBar } from './cardData'

const BAR_USD = {
	compact: true,
	minimumCompactValue: 1_000_000,
	compactSuffix: 'lowercase',
	maximumFractionDigits: 1
} as const
/** The bar leaves room for its label in the same column. */
const BAR_MAX_WIDTH_PCT = 45

export const RWA_CARD_FILTER_NOTE =
	'Follows the scope toggles and the page defaults; the other filters apply to the table only.'

export function formatRwaSignedUsd(value: number): string {
	return `${value >= 0 ? '+' : '-'}${formatRwaKpiUsd(Math.abs(value))}`
}

function formatBarUsd(value: number): string {
	return formatUsd(value, BAR_USD)
}

function formatBarSignedUsd(value: number): string {
	return `${value >= 0 ? '+' : '-'}${formatUsd(Math.abs(value), BAR_USD)}`
}

/** One decimal up to three digits, none above, no grouping: the label has to fit beside the bar. */
function formatBarPercent(value: number): string {
	const digits = Math.abs(value) >= 100 ? 0 : 1
	return `${value >= 0 ? '+' : ''}${formatPercent(value, { input: 'percent', maximumFractionDigits: digits, useGrouping: false })}`
}

export function getRwaChangeTone(value: number | null): 'text-data-up' | 'text-data-down' | 'text-secondary' {
	if (value == null || value === 0) return 'text-secondary'
	return value > 0 ? 'text-data-up' : 'text-data-down'
}

type RwaBarRow = {
	name: string
	logo: 'token' | 'chain'
	share: number
	tone: 'bg-brand' | 'bg-data-up' | 'bg-data-down'
	text: string
}

/** A labelled bar list: the bar takes its share of the column, the text sits beside it. */
function RWABars({ rows }: { rows: Array<RwaBarRow> }) {
	if (rows.length === 0) return <p className="my-auto text-center text-xs text-tertiary">No data yet.</p>
	return (
		<ul className="my-auto flex flex-col gap-1 text-xs">
			{rows.map((row) => (
				<li key={row.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2">
					<span className="flex items-center justify-end gap-1 text-secondary">
						<TokenLogo name={row.name} kind={row.logo} size={14} alt="" />
						<span className="truncate">{row.name}</span>
					</span>
					<span className="flex items-center gap-1">
						<span
							className={`h-2.5 shrink-0 rounded-xs ${row.tone}`}
							style={{ width: `${row.share * BAR_MAX_WIDTH_PCT}%` }}
						/>
						<span className="truncate text-tertiary">{row.text}</span>
					</span>
				</li>
			))}
		</ul>
	)
}

/** Ten labelled bars, the largest first, the value beside each. */
export function RWAValueBars({ bars }: { bars: Array<RwaNamedBar> }) {
	const max = Math.max(0, ...bars.map((bar) => bar.value))
	if (max <= 0) return <RWABars rows={[]} />
	return (
		<RWABars
			rows={bars.map((bar) => ({
				name: bar.name,
				logo: 'token',
				share: bar.value / max,
				tone: 'bg-brand',
				text: formatBarUsd(bar.value)
			}))}
		/>
	)
}

/** Gains then losses, green up and red down, dollars on the bar and percent in the label. */
export function RWAChangeBars({ bars }: { bars: Array<RwaChangeBar> }) {
	const max = Math.max(0, ...bars.map((bar) => Math.abs(bar.changeUsd)))
	if (max <= 0) return <RWABars rows={[]} />
	return (
		<RWABars
			rows={bars.map((bar) => ({
				name: bar.name,
				logo: 'chain',
				share: Math.abs(bar.changeUsd) / max,
				tone: bar.changeUsd >= 0 ? 'bg-data-up' : 'bg-data-down',
				text: `${formatBarSignedUsd(bar.changeUsd)}${bar.changePct == null ? '' : ` (${formatBarPercent(bar.changePct)})`}`
			}))}
		/>
	)
}
