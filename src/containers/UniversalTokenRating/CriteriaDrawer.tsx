import { useRef, useState } from 'react'
import { Card } from '~/ui/Card'
import { DialogBackButton, DialogBody, DialogHeader, SideSheet, useOpeningKey } from '~/ui/Dialog'
import { keepFocus } from '~/ui/focus'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { RailItem } from '~/ui/RailItem'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { getCriterionDrawerCopy, MARKET_MAKER_MATURITY_EXCEPTION } from './criterionDrawerCopy'
import { DisclosureDetails } from './DisclosureDetails'
import { GradeBadge, ScoreBar } from './grades'
import type { UtrCriterionBreakdown, UtrCriterionDoc, UtrDisclosures, UtrGradingConfig } from './types'

export type CriteriaDrawerState = {
	title: string
	axis: 'disclosure' | 'performance'
	criteria: Array<UtrCriterionBreakdown>
	docs: Array<UtrCriterionDoc>
	/** The criterion the sheet opens on; null opens on the list. */
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

type CriteriaDrawerProps = {
	state: CriteriaDrawerState | null
	assetLabel?: string
	lastEditedAt?: string | null
	disclosures?: UtrDisclosures | null
	grading?: UtrGradingConfig | null
	onClose: () => void
}

export function CriteriaDrawer({ state, ...props }: CriteriaDrawerProps) {
	// The sheet keeps showing the last criteria while it slides out after `state` clears.
	const [last, setLast] = useState(state)
	if (state && state !== last) setLast(state)
	const shown = state ?? last
	const key = useOpeningKey(state != null)
	if (!shown || shown.criteria.length === 0) return null
	return (
		<SideSheet size="lg" canvas open={state != null} onClose={props.onClose} portal unmountOnHide>
			<CriteriaSheetContent key={key} state={shown} {...props} />
		</SideSheet>
	)
}

function CriteriaSheetContent({
	state,
	assetLabel,
	lastEditedAt,
	disclosures,
	grading
}: Omit<CriteriaDrawerProps, 'state' | 'onClose'> & { state: CriteriaDrawerState }) {
	// Below md one pane shows at a time. Opening from a criterion lands on its detail.
	const [narrowPane, setNarrowPane] = useState<'list' | 'detail'>(state.activeKey ? 'detail' : 'list')
	const [activeKey, setActiveKey] = useState(state.activeKey)
	const navRef = useRef<HTMLElement>(null)
	const active = state.criteria.find((criterion) => criterion.key === activeKey) ?? state.criteria[0]
	const activeIndex = state.criteria.indexOf(active)
	const doc = state.docs.find((entry) => entry.key === active.key) ?? null
	const activeCopy = getCriterionDrawerCopy(state.axis, active.key, active.label, doc?.definition)
	const subtitle =
		state.axis === 'performance'
			? 'Auto-graded from market data'
			: lastEditedAt
				? `Last edited ${lastEditedAt.slice(0, 10)}`
				: null

	return (
		<>
			<DialogHeader
				title={state.title}
				subtitle={subtitle}
				leading={
					narrowPane === 'detail' ? (
						<div className="flex md:hidden">
							<DialogBackButton
								label="Back to criteria"
								onClick={() =>
									keepFocus(
										() => setNarrowPane('list'),
										() => navRef.current?.querySelector<HTMLElement>('[aria-current="true"]')
									)
								}
							/>
						</div>
					) : null
				}
			/>
			<DialogBody kind="flush">
				<div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[290px_minmax(0,1fr)]">
					<nav
						ref={navRef}
						aria-label="Criteria"
						className={`flex min-h-0 flex-col gap-1 overflow-y-auto p-2 md:border-r md:border-subtle ${
							narrowPane === 'detail' ? 'max-md:hidden' : ''
						}`}
					>
						{state.criteria.map((criterion, index) => {
							const current = criterion.key === active.key
							return (
								<RailItem
									as="button"
									key={criterion.key}
									type="button"
									active={current}
									aria-current={current ? 'true' : undefined}
									onClick={() => {
										setActiveKey(criterion.key)
										setNarrowPane('detail')
									}}
								>
									{index + 1}.{' '}
									{
										getCriterionDrawerCopy(
											state.axis,
											criterion.key,
											criterion.label,
											state.docs.find((entry) => entry.key === criterion.key)?.definition
										).navigationLabel
									}
								</RailItem>
							)
						})}
					</nav>
					<section
						aria-label={activeCopy.heading}
						className={`flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 ${narrowPane === 'list' ? 'max-md:hidden' : ''}`}
					>
						<h3 className="label-lg text-primary">
							{activeIndex + 1}. {activeCopy.heading}
						</h3>
						{activeCopy.definition ? <p className="body-md text-secondary">{activeCopy.definition}</p> : null}
						{activeCopy.showMarketMakerMaturityException ? (
							<div className="flex max-w-[75ch] flex-col gap-3 body-md text-secondary">
								<p>
									{state.axis === 'disclosure'
										? MARKET_MAKER_MATURITY_EXCEPTION.disclosureNote
										: MARKET_MAKER_MATURITY_EXCEPTION.performanceNote}
								</p>
								<p>{MARKET_MAKER_MATURITY_EXCEPTION.intro}</p>
								<ul className="list-disc space-y-1 pl-6">
									{MARKET_MAKER_MATURITY_EXCEPTION.criteria.map((criterion) => (
										<li key={criterion}>{criterion}</li>
									))}
								</ul>
								<p>{MARKET_MAKER_MATURITY_EXCEPTION.outro}</p>
							</div>
						) : null}
						{state.axis === 'performance' && assetLabel ? (
							<p className="body-md text-primary">
								{assetLabel} was calculated as &quot;{active.raw == null ? 'N/A' : formatNumber(active.raw)}&quot; for
								this metric.
							</p>
						) : null}
						<Card padding="strip" className="flex flex-wrap items-center justify-between gap-4">
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
						</Card>
						{active.note ? <p className="body-md text-secondary">{active.note}</p> : null}
						{state.axis === 'disclosure' && disclosures ? (
							<DisclosureDetails criterionKey={active.key} disclosures={disclosures} />
						) : null}
						{doc?.rubric.length ? (
							<div className="flex flex-col gap-2">
								<h4 className="label-md text-primary">Scoring rubric</h4>
								<Card padding="none" className="overflow-hidden">
									<div className="flex items-center justify-between gap-3 bg-brand px-4 py-2 label-sm text-on-brand">
										<span className="flex-1 text-center">Rubric</span>
										<span>Value (/10)</span>
									</div>
									{doc.rubric.map((text, index) => (
										<div
											// oxlint-disable-next-line react/no-array-index-key -- Rubric position identifies the score band (10 - index), not its prose.
											key={`${active.key}-${index}`}
											className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-2"
										>
											<span className="body-sm text-primary">{text}</span>
											<RubricValueBadge value={10 - index} />
										</div>
									))}
								</Card>
							</div>
						) : null}
					</section>
				</div>
			</DialogBody>
		</>
	)
}
