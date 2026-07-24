import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { formatVerified } from '../format'
import { toneClasses, type Tone } from '../kindMeta'
import type { Audit, CollateralVM, ExitReadinessVM, HeadlineVM, ScenarioVM, Stress } from '../types'
import type { HistoryIncident } from './HistoryStrip'
import { LossCurve, type LossVizProps } from './LossCurve'
import { PositionControl, usePositionUsd } from './PositionControl'

// One orient block in the three-question strip; severity is carried by the value's tone +
// label, never by the block.
function QuestionBlock({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-2 bg-surface p-4">
			<span className="label-sm text-secondary">{label}</span>
			{children}
		</div>
	)
}

function Stat({ value, sub }: { value: React.ReactNode; sub?: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="label-lg text-primary tabular-nums">{value}</span>
			{sub ? <span className="body-md text-secondary">{sub}</span> : null}
		</div>
	)
}

// "Recorded" phrasing on the clean case — absence of evidence, not a proven zero.
function trackRecordSummary(incidents: HistoryIncident[]): { label: string; tone: Tone; detail: string | null } {
	const totalLost = incidents.reduce((a, i) => a + (i.usdLost || 0), 0)
	const totalRecovered = incidents.reduce((a, i) => a + Math.min(i.usdRecovered || 0, i.usdLost || 0), 0)
	if (!incidents.length) return { label: 'No pool-level losses recorded', tone: 'good', detail: null }
	const n = incidents.length === 1 ? '1 incident' : `${incidents.length} incidents`
	if (totalLost > 0 && totalRecovered >= totalLost) return { label: `${n} · made whole`, tone: 'good', detail: null }
	return {
		label: `${formatUsd(totalLost, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} lost`,
		tone: 'danger',
		detail: `${n}${totalRecovered > 0 ? `, ${formatUsd(totalRecovered, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} recovered` : ', not recovered'}`
	}
}

function auditsPhrase(audits: Audit[]): string {
	if (!audits.length) return 'no audits on record'
	const latest = audits
		.map((a) => a.date)
		.filter(Boolean)
		.sort()
		.at(-1)
	return `${audits.length} audits${latest ? `, latest ${formatVerified(latest)}` : ''}`
}

export function RiskVerdict({
	headline,
	scenarios,
	collateral,
	stress,
	supplyUsd,
	exit,
	audits,
	incidents
}: {
	headline: HeadlineVM
	scenarios: ScenarioVM[]
	collateral: CollateralVM[]
	stress?: Stress | null
	supplyUsd: number
	exit: ExitReadinessVM
	audits: Audit[]
	incidents: HistoryIncident[]
}) {
	const worst = headline.worstCaseMaxUsd
	const noEscape = headline.worstCaseWindow?.kind === 'no-escape'

	// "Your deposit": when set, depositor-facing dollar figures scale pro-rata to your slice.
	const [position, setPosition] = usePositionUsd()
	const personal = position != null && position > 0 && supplyUsd > 0
	const ratio = personal ? position / supplyUsd : 1

	const avail = exit.availableLiquidityUsd
	const util =
		exit.utilization != null
			? ` (${formatPercent(exit.utilization, { input: 'fraction', maximumFractionDigits: 0 })} utilized)`
			: ''
	const withdrawable =
		exit.poolType === 'market' && avail != null
			? personal
				? position <= avail
					? `your ${formatUsd(position, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} could exit today — ${formatUsd(avail, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} withdrawable${util}`
					: `you couldn't fully exit today — ${formatUsd(avail, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} withdrawable${util}`
				: `${formatUsd(avail, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} withdrawable now${util}`
			: 'withdraw via underlying markets'

	// "Can I exit?" — only timelocked governance changes give a window; every other modeled
	// failure is no-warning.
	const escapableCount = scenarios.filter((s) => s.status === 'computed' && s.actingWindow.kind === 'window').length
	const exitWindowLabel = exit.bestExitWindow
		? exit.bestExitWindow.maxSec >= 86400
			? `${Math.round(exit.bestExitWindow.maxSec / 86400)}-day`
			: exit.bestExitWindow.label.replace(' withdraw window', '')
		: null
	const exitValue = exit.poolType === 'market' && avail != null ? withdrawable : 'Via underlying markets'
	const exitCaveat =
		escapableCount > 0 && exitWindowLabel
			? `only governance changes give a ${exitWindowLabel} timelock to exit — every other modeled failure is no-warning`
			: 'every modeled failure here hits with no warning'

	const covPct = worst > 0 ? Math.min(100, Math.round((headline.coverageTotalUsd / worst) * 100)) : 0
	const fullyCovered = worst > 0 && headline.coverageTotalUsd >= worst

	const tr = trackRecordSummary(incidents)
	// "No losses" earns green; a realized loss reads in neutral ink — never a red number.
	const trToneCls = tr.tone === 'good' ? toneClasses('good').text : ''
	const trackSub = [tr.detail, auditsPhrase(audits)].filter(Boolean).join(' · ')

	const lossProps: LossVizProps = {
		scenarios,
		collateral,
		stress: stress ?? null,
		supplyUsd,
		worstUsd: worst,
		worstTitle: headline.worstCaseTitle,
		noEscape,
		ratio,
		personal,
		position,
		coverageUsd: headline.coverageTotalUsd
	}

	return (
		<div className="relative flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
					{/* neutral phrasing until a deposit is entered — "I/lose" only once scaled */}
					<span className="label-sm text-secondary">
						{personal ? 'How much could I lose?' : 'How much could be lost?'}
					</span>
					{supplyUsd > 0 && worst > 0 ? <PositionControl position={position} onChange={setPosition} /> : null}
				</div>
				{worst > 0 ? (
					<LossCurve {...lossProps} />
				) : (
					<p className="body-md text-secondary">No quantified loss scenarios for this pool yet.</p>
				)}
			</div>

			<div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-subtle bg-border-subtle sm:grid-cols-3">
				<QuestionBlock label="Can I exit?">
					<Stat value={exitValue} sub={exitCaveat} />
				</QuestionBlock>

				<QuestionBlock label="What backs it?">
					<Stat
						value={
							worst <= 0 ? (
								'—'
							) : fullyCovered ? (
								<span className={toneClasses('good').text}>Could cover in full</span>
							) : covPct > 0 ? (
								`${formatPercent(covPct, { input: 'percent' })} backstop`
							) : (
								'No committed backstop'
							)
						}
						sub={
							// "could cover", never "covers": coverage is committed capacity, not a settled
							// promise — most layers still need a vote before a depositor sees anything.
							worst <= 0
								? undefined
								: fullyCovered
									? `${formatUsd(headline.coverageTotalUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} committed could cover the worst case`
									: covPct > 0
										? `${formatUsd(headline.coverageTotalUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} committed against ${formatUsd(worst * ratio, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
										: 'nothing committed would cover a loss'
						}
					/>
				</QuestionBlock>

				<QuestionBlock label="Track record">
					<Stat value={<span className={trToneCls}>{tr.label}</span>} sub={trackSub || undefined} />
				</QuestionBlock>
			</div>
		</div>
	)
}
