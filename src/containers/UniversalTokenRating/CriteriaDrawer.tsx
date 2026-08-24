import { SecondaryBadge } from '~/containers/MarketMakers/badges'
import { Drawer } from '~/containers/MarketMakers/Drawer'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { GradeBadge, ScoreBar } from './grades'
import type { UtrCriterionBreakdown, UtrCriterionDoc, UtrGradingConfig } from './types'

export type CriteriaDrawerState = {
	title: string
	axis: 'disclosure' | 'performance'
	criteria: UtrCriterionBreakdown[]
	docs: UtrCriterionDoc[]
	activeKey: string | null
}

const RUBRIC_VALUE_COLORS = [
	'#b23a38',
	'#b34c37',
	'#b75f38',
	'#b96d39',
	'#bd8639',
	'#c0a03a',
	'#b1a93e',
	'#9fb242',
	'#58a351',
	'#359b58',
	'#11935f'
] as const

function RubricValueBadge({ value }: { value: number }) {
	return (
		<span
			className="inline-flex min-w-8 items-center justify-center rounded-sm px-2 py-0.5 mono-sm text-utr-grade-on-color tabular-nums"
			style={{ backgroundColor: RUBRIC_VALUE_COLORS[Math.max(0, Math.min(10, value))] }}
		>
			{value}
		</span>
	)
}

export function CriteriaDrawer({
	state,
	assetLabel,
	lastEditedAt,
	grading,
	onSelect,
	onClose
}: {
	state: CriteriaDrawerState | null
	assetLabel?: string
	lastEditedAt?: string | null
	grading?: UtrGradingConfig | null
	onSelect: (key: string) => void
	onClose: () => void
}) {
	if (!state || !state.criteria.length) return null
	const active = state.criteria.find((criterion) => criterion.key === state.activeKey) ?? state.criteria[0]
	const activeIndex = state.criteria.indexOf(active)
	const doc = state.docs.find((entry) => entry.key === active.key) ?? null

	return (
		<Drawer
			open
			onClose={onClose}
			title={state.title}
			widthClassName="sm:max-w-[1110px]"
			headerExtra={lastEditedAt ? <SecondaryBadge>{`Last Edited: ${lastEditedAt.slice(0, 10)}`}</SecondaryBadge> : null}
		>
			<div className="flex min-h-0 flex-1 flex-col bg-(--bg-page) sm:flex-row">
				<nav className="flex shrink-0 flex-col gap-1 border-b border-subtle p-2 sm:w-[290px] sm:border-r sm:border-b-0">
					{state.criteria.map((criterion, index) => (
						<button
							key={criterion.key}
							type="button"
							onClick={() => onSelect(criterion.key)}
							className={`cursor-pointer rounded-md px-3 py-2 text-left body-sm hover:bg-hover-row ${
								criterion.key === active.key ? 'bg-surface-elevated-1 text-primary' : 'text-secondary'
							}`}
						>
							{index + 1}. {criterion.label}
						</button>
					))}
				</nav>
				<div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
					<h3 className="heading-xs">
						{activeIndex + 1}. {active.label}
					</h3>
					{doc?.definition ? <p className="body-lg text-secondary">{doc.definition}</p> : null}
					{state.axis === 'performance' && assetLabel ? (
						<p className="label-lg">
							{assetLabel} was calculated as &quot;{active.raw == null ? 'N/A' : formatNumber(active.raw)}&quot; for
							this metric.
						</p>
					) : null}
					<div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-subtle bg-surface px-4 py-3">
						<span className="flex flex-col gap-1">
							<span className="body-sm text-tertiary">Grade</span>
							<GradeBadge
								score={active.score}
								scale={10}
								grade={active.grade}
								gradingScale={grading?.[state.axis].scale}
							/>
						</span>
						<span className="flex flex-col gap-1">
							<span className="body-sm text-tertiary">Score</span>
							<span className="flex items-center gap-2">
								<ScoreBar
									score={active.score}
									scale={10}
									grade={active.grade}
									gradingScale={grading?.[state.axis].scale}
								/>
								<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
							</span>
						</span>
						<span className="flex flex-col gap-1">
							<span className="body-sm text-tertiary">Percentile</span>
							<span className="mono-md tabular-nums">
								{active.percentile == null
									? 'N/A'
									: formatPercent(active.percentile, {
											input: 'percent',
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
											smallValueDisplay: 'rounded',
											useGrouping: false
										})}
							</span>
						</span>
						<span className="flex flex-col gap-1">
							<span className="body-sm text-tertiary">Weight</span>
							<span className="mono-md tabular-nums">{Math.round(active.weight * 100)}%</span>
						</span>
					</div>
					{active.note ? <p className="body-lg text-secondary">{active.note}</p> : null}
					{doc?.rubric.length ? (
						<div className="flex flex-col gap-2">
							<h4 className="label-lg">Scoring Rubric</h4>
							<div className="overflow-hidden rounded-lg border border-subtle bg-surface">
								<div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 label-sm text-on-brand">
									<span className="flex-1 text-center">Rubric</span>
									<span>Value (/10)</span>
								</div>
								{doc.rubric.map((text, index) => (
									<div
										key={`${active.key}-${index}`}
										className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-2"
									>
										<span className="body-sm text-primary">{text}</span>
										<RubricValueBadge value={10 - index} />
									</div>
								))}
							</div>
						</div>
					) : null}
				</div>
			</div>
		</Drawer>
	)
}
