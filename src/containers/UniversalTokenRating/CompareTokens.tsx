import { useRouter } from 'next/router'
import { useState } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { formatPercentChangeText } from '~/ui/PercentChange'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatNumber } from '~/utils/numberFormat'
import { CategoryBreakdownTable, rowBreakdownColumns } from './CategoryBreakdown'
import { LISTING_STATUS_LABELS } from './constants'
import { GradeBadge, ScoreBar } from './grades'
import { PerformanceMatrix } from './PerformanceMatrix'
import type { UtrGradingConfig, UtrLeaderboardRow, UtrScoringConfig, UtrUniverse } from './types'

function SummaryCard({ row, grading }: { row: UtrLeaderboardRow; grading?: UtrGradingConfig | null }) {
	const momText = formatPercentChangeText(row.scores.overallMomChangePct)
	const rows: Array<[string, React.ReactNode]> = [
		['Status', <span key="status">{LISTING_STATUS_LABELS[row.listingStatus]}</span>],
		[
			'Grade',
			<GradeBadge key="grade" score={row.scores.overall} grade={row.grade} gradingScale={grading?.overall.scale} />
		],
		[
			'Overall Score',
			<span key="overall" className="flex items-center gap-2">
				<ScoreBar score={row.scores.overall} grade={row.grade} gradingScale={grading?.overall.scale} />
			</span>
		],
		[
			'MoM Change',
			<span
				key="mom"
				className={`font-jetbrains tabular-nums ${
					(row.scores.overallMomChangePct ?? 0) >= 0 ? 'text-success' : 'text-error'
				}`}
			>
				{momText ?? 'N/A'}
			</span>
		],
		[
			'Disclosure Score',
			<ScoreBar
				key="disclosure"
				score={row.scores.disclosure}
				scale={10}
				grade={row.disclosureGrade}
				gradingScale={grading?.disclosure.scale}
			/>
		],
		[
			'Performance Score',
			<ScoreBar
				key="performance"
				score={row.scores.performance}
				scale={10}
				grade={row.performanceGrade}
				gradingScale={grading?.performance.scale}
			/>
		],
		[
			'FDV',
			<span key="fdv" className="font-jetbrains tabular-nums">
				{row.fdvUsd == null ? 'N/A' : `$${formatNumber(row.fdvUsd)}`}
			</span>
		]
	]
	return (
		<Panel padding="none">
			<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
				<span className="flex items-center gap-2">
					<TokenLogo src={row.coingeckoId ? geckoTokenIconUrl(row.coingeckoId) : null} size={24} />
					<span className="flex flex-col">
						<span className="label-md">{row.symbol}</span>
						<span className="body-xs text-tertiary">{row.name}</span>
					</span>
				</span>
				<span className="mono-sm tabular-nums">
					Rank: <span className="text-primary">{row.scores.rank ?? 'N/A'}</span>
				</span>
			</div>
			{rows.map(([label, value]) => (
				<div
					key={label}
					className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2 last:border-b-0"
				>
					<span className="body-sm text-secondary">{label}</span>
					{value}
				</div>
			))}
		</Panel>
	)
}

function CompareColumn({
	label,
	universe,
	selected,
	exclude,
	grading,
	onSelect
}: {
	label: string
	universe: UtrUniverse
	selected: string | null
	exclude: string | null
	grading?: UtrGradingConfig | null
	onSelect: (asset: string) => void
}) {
	const row = selected ? (universe.rows.find((entry) => entry.asset === selected) ?? null) : null
	const columns = row ? rowBreakdownColumns(row) : null
	return (
		<div className="flex min-w-0 flex-1 flex-col gap-3">
			<div className="flex items-center gap-2">
				<span className="label-md">{label}:</span>
				<SelectWithCombobox
					heading="Token"
					allValues={universe.rows
						.filter((entry) => entry.asset !== exclude)
						.map((entry) => ({ key: entry.asset, name: `${entry.name} (${entry.symbol})` }))}
					selectedValues={selected ? [selected] : []}
					setSelectedValues={(values) => {
						const next = values[values.length - 1]
						if (next) onSelect(next)
					}}
					singleSelect
					label={row ? `${row.name} (${row.symbol})` : 'Select a Token'}
					labelType="none"
					variant="filter"
					size="md"
				/>
			</div>
			{row && columns ? (
				<>
					<SummaryCard row={row} grading={grading} />
					<Panel padding="none">
						<PerformanceMatrix rows={[row]} grading={grading} className="h-[300px] w-full" />
					</Panel>
					<CategoryBreakdownTable
						title="Disclosures: Breakdown by Category"
						columns={columns.disclosure}
						gradingScale={grading?.disclosure.scale}
					/>
					<CategoryBreakdownTable
						title="Performance: Breakdown by Category"
						columns={columns.performance}
						gradingScale={grading?.performance.scale}
					/>
				</>
			) : (
				<div className="flex min-h-[420px] flex-col items-center justify-center gap-1 rounded-lg border border-subtle bg-surface p-6 text-center">
					<Icon name="file-plus" height={24} width={24} className="text-tertiary" />
					<p className="label-lg">No Token Selected</p>
					<p className="body-sm text-tertiary">Select a token above to start comparing.</p>
				</div>
			)}
		</div>
	)
}

export function CompareTokens({
	universe,
	scoringConfig
}: {
	universe: UtrUniverse
	scoringConfig?: UtrScoringConfig | null
}) {
	const router = useRouter()
	const queryToken = typeof router.query.token === 'string' ? router.query.token : null
	const [tokenAState, setTokenAState] = useState<string | null>(null)
	const [tokenB, setTokenB] = useState<string | null>(null)
	const tokenA = tokenAState ?? queryToken

	if (universe.rows.length === 0) return null

	return (
		<div className="flex flex-col gap-4 lg:flex-row">
			<CompareColumn
				label="Token A"
				universe={universe}
				selected={tokenA}
				exclude={tokenB}
				grading={scoringConfig?.grading}
				onSelect={setTokenAState}
			/>
			<div className="hidden w-px bg-(--border-subtle) lg:block" />
			<CompareColumn
				label="Token B"
				universe={universe}
				selected={tokenB}
				exclude={tokenA}
				grading={scoringConfig?.grading}
				onSelect={setTokenB}
			/>
		</div>
	)
}
