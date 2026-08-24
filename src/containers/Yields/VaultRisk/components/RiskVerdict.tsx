import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { formatVerified } from '../format'
import { toneClasses, type Tone } from '../kindMeta'
import type { Audit, ExitReadinessVM, HeadlineVM, ScenarioVM, Stress } from '../types'
import type { HistoryIncident } from './HistoryStrip'
import { PositionControl, usePositionUsd } from './PositionControl'
import { formatDepositPct } from './scenarioShared'

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
export function trackRecordSummary(incidents: HistoryIncident[]): {
	label: string
	tone: Tone
	detail: string | null
} {
	let totalLost = 0
	let totalRecovered = 0
	let recoveryUnavailable = false
	for (const incident of incidents) {
		totalLost += incident.usdLost
		if (incident.usdRecovered === null) recoveryUnavailable = true
		else totalRecovered += Math.min(incident.usdRecovered, incident.usdLost)
	}
	if (!incidents.length)
		return {
			label: 'No pool-level losses recorded',
			tone: 'good',
			detail: null
		}
	const n = incidents.length === 1 ? '1 incident' : `${incidents.length} incidents`
	if (!recoveryUnavailable && totalLost > 0 && totalRecovered >= totalLost) {
		return { label: `${n} · made whole`, tone: 'good', detail: null }
	}
	const recovered =
		totalRecovered > 0
			? `${formatUsd(totalRecovered, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} recovered`
			: null
	const recovery = recoveryUnavailable
		? [recovered, 'recovery unavailable'].filter(Boolean).join(', ')
		: (recovered ?? 'not recovered')
	return {
		label: `${formatUsd(totalLost, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} lost`,
		tone: 'danger',
		detail: `${n}, ${recovery}`
	}
}

// The largest realistic (below-catastrophe) loss: the deepest depeg anchor still sitting
// meaningfully under the worst case, else the worst computed scenario in that band. Null when
// every modeled path is a total loss — then there's no smaller-loss story to tell.
function realisticWorst(
	scenarios: ScenarioVM[],
	stress: Stress | null,
	supplyUsd: number | null,
	worstUsd: number
): { lossUsd: number; condition: string } | null {
	if (supplyUsd == null || supplyUsd <= 0) return null
	const ceil = worstUsd > 0 ? worstUsd : supplyUsd
	const inBand = (usd: number) => usd > supplyUsd * 0.01 && usd < ceil * 0.95
	const anchors = (stress?.anchors ?? []).filter((a) => inBand(a.bad_debt_usd))
	if (anchors.length) {
		const deepest = anchors.reduce((best, a) => (a.bad_debt_usd > best.bad_debt_usd ? a : best))
		return {
			lossUsd: deepest.bad_debt_usd,
			condition: `if collateral falls ${deepest.drop_pct}%`
		}
	}
	const worstBelow = [...scenarios]
		.filter((s) => s.status === 'computed' && inBand(s.lossMaxUsd))
		.sort((a, b) => b.lossMaxUsd - a.lossMaxUsd)[0]
	return worstBelow
		? {
				lossUsd: worstBelow.lossMaxUsd,
				condition: `from ${worstBelow.title.toLowerCase()}`
			}
		: null
}

// One number, one cause, then the ceiling as a sentence. Both figures are shares of the
// deposit, so they read the same for every depositor. Deliberately NOT two stats at opposite
// ends of a row: the reader shouldn't have to work out how the figures relate.
function LossHeadline({
	realistic,
	worstUsd,
	worstTitle,
	supplyUsd,
	noEscape,
	position
}: {
	realistic: { lossUsd: number; condition: string } | null
	worstUsd: number
	worstTitle: string | null
	supplyUsd: number | null
	noEscape: boolean
	position: number | null
}) {
	const share = (usd: number) => formatDepositPct(supplyUsd != null && supplyUsd > 0 ? Math.min(1, usd / supplyUsd) : 0)
	const inDollars = (usd: number) =>
		position != null && supplyUsd != null && supplyUsd > 0
			? ` · ≈ ${formatUsd(usd * Math.min(1, position / supplyUsd), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
			: ''
	const catLabel = worstTitle ?? 'worst case'

	if (!realistic)
		return (
			<p className="body-md text-secondary">
				{'Every modeled failure here risks '}
				<span className="text-primary">
					{position != null
						? `~${formatUsd(position, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
						: 'the full deposit'}
				</span>
				{' — there’s no smaller-loss path. Worst case: '}
				<span className="text-primary">
					{catLabel}
					{noEscape ? ' (no warning to exit)' : ''}
				</span>
				.
			</p>
		)

	return (
		<div className="flex flex-col gap-1">
			<span className="flex flex-wrap items-baseline gap-x-2">
				<span className="mono-xl text-primary tabular-nums">{share(realistic.lossUsd)}</span>
				<span className="body-md text-secondary">
					{`of your deposit ${realistic.condition}`}
					{inDollars(realistic.lossUsd)}
				</span>
			</span>
			<span className="body-sm text-secondary">
				{'Only '}
				{catLabel.toLowerCase()}
				{' reaches a total '}
				<span className="text-primary tabular-nums">{share(worstUsd)}</span>
				{noEscape ? ', with no warning to exit' : ''}
				{'.'}
			</span>
		</div>
	)
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
	stress,
	supplyUsd,
	exit,
	audits,
	incidents
}: {
	headline: HeadlineVM
	scenarios: ScenarioVM[]
	stress?: Stress | null
	supplyUsd: number | null
	exit: ExitReadinessVM
	audits: Audit[]
	incidents: HistoryIncident[]
}) {
	const worst = headline.worstCaseMaxUsd
	const noEscape = headline.worstCaseWindow?.kind === 'no-escape'

	// "Your deposit": when set, depositor-facing dollar figures scale pro-rata to your slice.
	const [position, setPosition] = usePositionUsd()
	const personal = position != null && position > 0 && supplyUsd != null && supplyUsd > 0
	const ratio = personal && supplyUsd != null ? position / supplyUsd : 1

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

	const realistic = realisticWorst(scenarios, stress ?? null, supplyUsd, worst)

	return (
		<div className="relative flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
					{/* neutral phrasing until a deposit is entered — "I/lose" only once scaled */}
					<span className="label-sm text-secondary">
						{personal ? 'How much could I lose?' : 'How much could be lost?'}
					</span>
					{supplyUsd != null && supplyUsd > 0 && worst > 0 ? (
						<PositionControl position={position} onChange={setPosition} />
					) : null}
				</div>
				{worst > 0 ? (
					<LossHeadline
						realistic={realistic}
						worstUsd={worst}
						worstTitle={headline.worstCaseTitle}
						supplyUsd={supplyUsd}
						noEscape={noEscape}
						position={position}
					/>
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
