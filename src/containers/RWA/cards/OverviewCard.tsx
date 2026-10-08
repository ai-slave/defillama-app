import { TokenLogo } from '~/components/TokenLogo'
import { SmolStatCard } from '~/ui/SmolStatCard'
import { formatPercent, formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { formatRwaKpiUsd } from '../kpi/format'
import { RWA_CARD_CHANGE_DAYS, type RwaChangeBar, type RwaChangeCard, type RwaNamedBar } from './cardData'

/** Whole dollars under a million, as the table prints them; one decimal on the compact values above. */
const BAR_USD = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const
/** The bar leaves room for its label in the same column. */
const BAR_MAX_WIDTH_PCT = 45

export function formatRwaSignedUsd(value: number): string {
	return `${value >= 0 ? '+' : '-'}${formatRwaKpiUsd(Math.abs(value))}`
}

export function formatRwaBarUsd(value: number, signed = true): string {
	const text = formatUsd(Math.abs(value), {
		...BAR_USD,
		maximumFractionDigits: Math.abs(value) < 1_000_000 ? 0 : 1
	})
	return `${value < 0 ? '-' : signed ? '+' : ''}${text}`
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
	/** Null for groups with no logo of their own, such as asset groups. */
	logo: 'token' | 'chain' | null
	share: number
	tone: 'bg-brand' | 'bg-data-up' | 'bg-data-down'
	text: string
}

/** A labelled bar list: the bar takes its share of the column, the text sits beside it. */
function RWABars({ rows }: { rows: Array<RwaBarRow> }) {
	if (rows.length === 0) return <p className="my-auto text-center body-sm text-tertiary">No data yet.</p>
	return (
		<ul className="my-auto flex flex-col gap-1 body-sm">
			{rows.map((row) => (
				<li key={row.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-2">
					<span className="flex items-center justify-end gap-1 text-secondary">
						{row.logo ? <TokenLogo name={row.name} kind={row.logo} size={14} alt="" /> : null}
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
export function RWAValueBars({ bars, logo = 'token' }: { bars: Array<RwaNamedBar>; logo?: RwaBarRow['logo'] }) {
	const max = Math.max(0, ...bars.map((bar) => bar.value))
	if (max <= 0) return <RWABars rows={[]} />
	return (
		<RWABars
			rows={bars.map((bar) => ({
				name: bar.name,
				logo,
				share: bar.value / max,
				tone: 'bg-brand',
				text: formatRwaBarUsd(bar.value, false)
			}))}
		/>
	)
}

/** Gains then losses, green up and red down, dollars on the bar and percent in the label. */
export function RWAChangeBars({ bars, logo }: { bars: Array<RwaChangeBar>; logo: RwaBarRow['logo'] }) {
	const max = Math.max(0, ...bars.map((bar) => Math.abs(bar.changeUsd)))
	if (max <= 0) return <RWABars rows={[]} />
	return (
		<RWABars
			rows={bars.map((bar) => ({
				name: bar.name,
				logo,
				share: Math.abs(bar.changeUsd) / max,
				tone: bar.changeUsd >= 0 ? 'bg-data-up' : 'bg-data-down',
				text: `${formatRwaBarUsd(bar.changeUsd)}${bar.changePct == null ? '' : ` (${formatBarPercent(bar.changePct)})`}`
			}))}
		/>
	)
}
/** A change card: the total's dollar change and percent over the card window, the names' largest gains and losses. */
export function RWAChangeCard({
	title,
	tooltip,
	card,
	logo
}: {
	title: string
	tooltip: string
	card: RwaChangeCard
	logo: RwaBarRow['logo']
}) {
	return (
		<SmolStatCard
			title={title}
			tooltip={tooltip}
			value={card.changeUsd == null ? null : formatRwaSignedUsd(card.changeUsd)}
			change={{
				text: card.changePct == null ? 'N/A' : formatPercentChange(card.changePct),
				tone: getRwaChangeTone(card.changeUsd),
				comparison: `over ${RWA_CARD_CHANGE_DAYS}d`
			}}
		>
			<RWAChangeBars bars={card.bars} logo={logo} />
		</SmolStatCard>
	)
}
