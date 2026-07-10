import { Icon } from '~/components/Icon'
import { formattedNum } from '~/utils'
import { scenarioTone } from '../derive'
import { guardianText } from '../format'
import { oracleBadge, toneClasses } from '../kindMeta'
import type { CoverageVM, ProtocolRiskFixture, ScenarioVM } from '../types'
import { ConditionsTree } from './ConditionsTree'
import { usePositionUsd } from './PositionControl'
import { isFullLoss, modeledLossCell, scaleToPosition, type StressSel, stressLossTitle } from './scenarioShared'

function exitWindowLabel(s: ScenarioVM): string {
	return s.actingWindow.kind === 'no-escape' ? 'Instant' : s.actingWindow.label.replace(' withdraw window', '')
}

function StatRow({
	label,
	value,
	active = false,
	muted = false
}: {
	label: React.ReactNode
	value: React.ReactNode
	active?: boolean
	muted?: boolean
}) {
	return (
		<div
			className={`-mx-1.5 flex items-center justify-between gap-3 rounded-md px-1.5 py-1 ${active ? 'bg-black/6 dark:bg-white/6' : ''}`}
		>
			<span
				className={`text-xs ${active ? 'font-medium text-(--legacy-text-primary)' : 'text-(--legacy-text-secondary)'}`}
			>
				{label}
			</span>
			<span
				className={`text-xs tabular-nums ${active ? 'font-semibold text-(--legacy-text-primary)' : muted ? 'text-(--legacy-text-secondary)' : 'font-medium text-(--legacy-text-primary)'}`}
			>
				{value}
			</span>
		</div>
	)
}

// The selected-stress loss as a share of this scenario's worst case — the ring fills as the
// stress climbs and sits full at the ceiling.
function LossRing({ pct, className = '', strokeWidth = 2 }: { pct: number; className?: string; strokeWidth?: number }) {
	const r = 7
	const circ = 2 * Math.PI * r
	const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ
	return (
		<svg viewBox="0 0 18 18" className={`-rotate-90 ${className}`} aria-hidden>
			<circle
				cx="9"
				cy="9"
				r={r}
				fill="none"
				strokeWidth={strokeWidth}
				className="stroke-black/10 dark:stroke-white/10"
			/>
			<circle
				cx="9"
				cy="9"
				r={r}
				fill="none"
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeDasharray={`${dash} ${circ}`}
				className="stroke-current transition-[stroke-dasharray] duration-300 ease-out motion-reduce:transition-none"
			/>
		</svg>
	)
}

// The ring inherits its severity colour via `stroke-current`; the figure stays neutral ink.
function LossHero({
	title,
	amount,
	note,
	pct,
	toneText,
	muted
}: {
	title: string
	amount: string
	note?: string | null
	pct: number
	toneText: string
	muted?: boolean
}) {
	return (
		<div className="flex items-center gap-3">
			<span className={`shrink-0 ${toneText}`}>
				<LossRing pct={pct} className="size-11" />
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="text-xs text-(--legacy-text-secondary)">{title}</span>
				<span
					className={`text-2xl font-semibold tabular-nums ${muted ? 'text-(--legacy-text-secondary)' : 'text-(--legacy-text-primary)'}`}
				>
					{amount}
				</span>
				{note ? <span className="mt-0.5 text-xs text-(--legacy-text-secondary)">{note}</span> : null}
			</span>
		</div>
	)
}

// The expanded row's numbers. Reads the SAME stress the row rendered at, so the two never
// disagree; a typed deposit rescales every figure pro-rata.
function LossBox({ scenario, supplyUsd, stress }: { scenario: ScenarioVM; supplyUsd: number; stress?: StressSel }) {
	const exit = exitWindowLabel(scenario)
	const [position] = usePositionUsd()
	const asYours = (poolUsd: number) => formattedNum(scaleToPosition(poolUsd, supplyUsd, position), true)
	const positionNote =
		position != null ? (
			<p className="mt-2 text-xs text-(--legacy-text-secondary)">
				Shown for your {formattedNum(position, true)} deposit.
			</p>
		) : null
	const box = 'flex flex-col self-start rounded-lg bg-(--legacy-bg-main) p-4'

	if (scenario.status !== 'computed') {
		return (
			<div className={box}>
				<p className="text-xs text-(--legacy-text-secondary)">Modeled loss</p>
				<p className="mt-1 text-xl font-semibold text-(--legacy-text-secondary)">Not quantified</p>
				<div className="mt-3 border-t border-(--legacy-cards-border) pt-3">
					<StatRow label="Exit window" value={exit} />
				</div>
			</div>
		)
	}

	const full = isFullLoss(scenario, supplyUsd)
	const worstValue = full ? 'Full deposit' : asYours(scenario.lossMaxUsd)
	const cell = modeledLossCell(scenario, stress)
	const heroAmount = cell.sortUsd > 0 ? asYours(cell.sortUsd) : cell.amount
	const tone = toneClasses(scenarioTone(scenario))
	const ringDenom = full && supplyUsd > 0 ? Math.min(scenario.lossMaxUsd, supplyUsd) : scenario.lossMaxUsd
	const ringPct = ringDenom > 0 ? Math.min(100, (cell.sortUsd / ringDenom) * 100) : 0
	const cappedNote =
		scenario.cappedAtSupply && scenario.rawLossMaxUsd ? (
			<p className="mt-2 text-xs text-(--legacy-text-secondary)">
				Capped at pool size: you can&apos;t lose more than is deposited.
			</p>
		) : null

	if (scenario.lossByAnchor?.length) {
		const headlineMuted = cell.amount === '$0' || cell.amount === '—'
		return (
			<div className={box}>
				<LossHero
					title={stressLossTitle(scenario, stress)}
					amount={heroAmount}
					note={cell.note}
					pct={ringPct}
					toneText={tone.text}
					muted={headlineMuted}
				/>
				<div className="mt-3 flex flex-col gap-0.5 border-t border-(--legacy-cards-border) pt-3">
					<p className="mb-0.5 text-[11px] text-(--legacy-text-secondary)">As collateral falls</p>
					{scenario.lossByAnchor.map((a) => (
						<StatRow
							key={a.dropPct}
							label={`−${a.dropPct}%`}
							value={a.lossUsd <= 0 ? '$0' : asYours(a.lossUsd)}
							active={stress === a.dropPct}
							muted={a.lossUsd <= 0}
						/>
					))}
					<StatRow label="Worst case" value={worstValue} active={stress === 'worst'} />
				</div>
				<div className="mt-3 border-t border-(--legacy-cards-border) pt-3">
					<StatRow label="Exit window" value={exit} />
				</div>
				{cappedNote}
				{positionNote}
			</div>
		)
	}

	// No per-drop curve: a worst-case-only scenario leads with the ceiling, not a bare "—".
	const worstOnly = cell.amount === '—'
	return (
		<div className={box}>
			<LossHero
				title={worstOnly ? 'Worst case' : stressLossTitle(scenario, stress)}
				amount={worstOnly ? worstValue : heroAmount}
				pct={worstOnly ? 100 : ringPct}
				toneText={tone.text}
				muted={!worstOnly && cell.amount === '$0'}
			/>
			{!worstOnly ? (
				<div className="mt-3 border-t border-(--legacy-cards-border) pt-3">
					<StatRow label="Worst case" value={worstValue} />
				</div>
			) : null}
			<div className="mt-3 border-t border-(--legacy-cards-border) pt-3">
				<StatRow label="Exit window" value={exit} />
			</div>
			{cappedNote}
			{positionNote}
		</div>
	)
}

function PerAssetTable({ scenario }: { scenario: ScenarioVM }) {
	if (!scenario.perAsset?.length) return null
	return (
		<div className="overflow-hidden rounded-md border border-(--legacy-cards-border)">
			<table className="w-full text-sm">
				<thead className="bg-(--legacy-bg-main) text-(--legacy-text-secondary)">
					<tr>
						<th className="px-3 py-2 text-left font-medium">Asset</th>
						<th className="px-3 py-2 text-left font-medium">Oracle</th>
						<th className="px-3 py-2 text-right font-medium">Max loss</th>
					</tr>
				</thead>
				<tbody>
					{scenario.perAsset.slice(0, 12).map((a) => (
						<tr key={a.address} className="border-t border-(--legacy-cards-border)">
							<td className="px-3 py-2 font-medium text-(--legacy-text-primary)">{a.symbol}</td>
							<td className="px-3 py-2 text-(--legacy-text-secondary)">
								{a.oracleType ? oracleBadge(a.oracleType).label : '—'}
							</td>
							<td className="px-3 py-2 text-right font-medium text-(--legacy-text-primary) tabular-nums">
								{formattedNum(a.lossMaxUsd, true)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{scenario.perAsset.length > 12 ? (
				<p className="px-3 py-2 text-sm text-(--legacy-text-secondary)">+{scenario.perAsset.length - 12} more assets</p>
			) : null}
		</div>
	)
}

function RealizedStrip({ scenario }: { scenario: ScenarioVM }) {
	if (!scenario.realized?.incidents?.length) return null
	return (
		<div className="rounded-md border border-amber-500/25 bg-amber-500/6 p-3">
			<p className="flex items-center gap-1.5 text-sm font-semibold text-(--warning)">
				<Icon name="flame" className="size-4" />
				This has actually happened
			</p>
			<ul className="mt-2 space-y-1.5">
				{scenario.realized.incidents.map((inc, i) => {
					const madeWhole = inc.usd_recovered >= inc.usd_lost && inc.usd_lost > 0
					return (
						<li key={i} className="flex flex-wrap items-center gap-x-2 text-sm text-(--legacy-text-secondary)">
							<span className="tabular-nums">{inc.date}</span>
							<span className="tabular-nums">
								{formattedNum(inc.usd_lost, true)} lost
								{inc.usd_recovered > 0 ? (
									<>
										{' · '}
										<span className={madeWhole ? 'text-(--success)' : undefined}>
											{formattedNum(inc.usd_recovered, true)} recovered{madeWhole ? ' (made whole)' : ''}
										</span>
									</>
								) : null}
							</span>
							{inc.post_mortem_url ? (
								<a
									href={inc.post_mortem_url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-0.5 underline decoration-dotted hover:text-(--legacy-text-primary)"
								>
									post-mortem <Icon name="external-link" className="size-3" />
								</a>
							) : null}
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function CoverageNote({ scenario }: { scenario: ScenarioVM }) {
	if (!scenario.coverage.length) return null
	const noEscape = scenario.actingWindow.kind === 'no-escape'
	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-xs font-semibold text-(--legacy-text-primary)">What could cover it</p>
			<ul className="space-y-1.5">
				{scenario.coverage.map((c: CoverageVM, i) => (
					<li key={i} className="flex flex-wrap items-center gap-x-2 text-sm text-(--legacy-text-secondary)">
						<span className="font-medium text-(--legacy-text-primary) tabular-nums">
							{formattedNum(c.capUsd, true)}
						</span>
						<span>{c.kind}</span>
						{noEscape && c.access !== 'instant' ? (
							<span className={toneClasses('warning').text}>— reimbursement after the fact</span>
						) : null}
					</li>
				))}
			</ul>
		</div>
	)
}

function WhoCanDoThis({ scenario, protocol }: { scenario: ScenarioVM; protocol: ProtocolRiskFixture | null }) {
	if (!protocol) return null
	const isGov = scenario.kind === 'governance'
	const isMultisig = scenario.kind === 'multisig'
	if (!isGov && !isMultisig) return null
	const parts: string[] = []
	if (isGov && protocol.governance) {
		const g = protocol.governance
		if (g.voting_power_concentration_top10_pct != null) {
			parts.push(`top 10 holders control ${(g.voting_power_concentration_top10_pct * 100).toFixed(1)}% of votes`)
		}
		const guardian = guardianText(g.guardian_role)
		if (guardian) parts.push(`guardian: ${guardian}`)
	}
	if (protocol.multisigs?.length) {
		const ms = protocol.multisigs[0]
		parts.push(`a ${ms.threshold.m}-of-${ms.threshold.n} multisig`)
	}
	if (!parts.length) return null
	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-xs font-semibold text-(--legacy-text-primary)">Who can pull the trigger</p>
			<p className="text-sm text-(--legacy-text-secondary)">{parts.join(' · ')}</p>
		</div>
	)
}

// For a data_gap the missing-data reason IS the answer; computed scenarios put their
// methodology caveat under "The math" instead.
function ReasonNote({ scenario }: { scenario: ScenarioVM }) {
	if (scenario.status === 'computed') return null
	return (
		<div className="rounded-md border border-(--legacy-cards-border) bg-(--legacy-bg-main) p-3">
			<p className="text-xs font-semibold text-(--legacy-text-primary)">Why this isn&apos;t quantified</p>
			<p className="mt-1 text-sm text-(--legacy-text-secondary)">
				Current on-chain inputs identify the scenario, but don&apos;t contain enough exposure data to size depositor
				impact.
			</p>
			{scenario.notes ? <p className="mt-1.5 text-sm text-(--legacy-text-secondary)">{scenario.notes}</p> : null}
		</div>
	)
}

function NarrativeBody({ scenario, protocol }: { scenario: ScenarioVM; protocol: ProtocolRiskFixture | null }) {
	return (
		<div className="flex flex-col gap-4">
			{scenario.oneLiner ? (
				<div className="flex flex-col gap-1.5">
					<p className="text-xs font-semibold text-(--legacy-text-primary)">What happens</p>
					<p className="max-w-[68ch] text-sm text-(--legacy-text-secondary)">{scenario.oneLiner}</p>
				</div>
			) : null}
			<ReasonNote scenario={scenario} />
			<RealizedStrip scenario={scenario} />
			<PerAssetTable scenario={scenario} />

			{scenario.conditions ? (
				<div className="flex flex-col gap-1.5">
					<p className="text-xs font-semibold text-(--legacy-text-primary)">Why it happens</p>
					<ConditionsTree conditions={scenario.conditions} protocol={protocol} />
				</div>
			) : null}

			<WhoCanDoThis scenario={scenario} protocol={protocol} />

			{scenario.mitigations.length ? (
				<div className="flex flex-col gap-1.5">
					<p className="text-xs font-semibold text-(--legacy-text-primary)">What softens it</p>
					<ul className="list-disc space-y-1 pl-5 text-sm marker:text-(--success)">
						{scenario.mitigations.map((m, i) => (
							<li key={i} className="text-(--legacy-text-secondary)">
								{m}
							</li>
						))}
					</ul>
				</div>
			) : null}

			<CoverageNote scenario={scenario} />

			{scenario.evidence.length ? (
				<div className="flex flex-col gap-1.5">
					<p className="text-xs font-semibold text-(--legacy-text-primary)">Evidence</p>
					<ul className="space-y-1">
						{scenario.evidence.map((e, i) => (
							<li key={i}>
								<a
									href={e.url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 text-sm text-(--legacy-text-secondary) underline decoration-dotted hover:text-(--legacy-text-primary)"
								>
									{e.title ?? e.note ?? e.url}
									<Icon name="external-link" className="size-3.5" />
								</a>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{Object.keys(scenario.inputs).length || (scenario.status === 'computed' && scenario.notes) ? (
				<details className="rounded-md border border-(--legacy-cards-border) p-2.5">
					<summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm text-(--legacy-text-secondary)">
						<span>The math{scenario.formula ? ` · ${scenario.formula}` : ''}</span>
						<Icon name="chevron-down" className="size-3.5 transition-transform in-[[open]]:rotate-180" />
					</summary>
					{scenario.status === 'computed' && scenario.notes ? (
						<p className="mt-2 text-xs text-(--legacy-text-secondary) italic">{scenario.notes}</p>
					) : null}
					{Object.keys(scenario.inputs).length ? (
						<dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
							{Object.entries(scenario.inputs).map(([k, v]) => (
								<div key={k} className="flex justify-between gap-2 text-sm">
									<dt className="text-(--legacy-text-secondary)">{k}</dt>
									<dd className="text-(--legacy-text-secondary) tabular-nums">
										{typeof v === 'number' ? formattedNum(v, false) : String(v)}
									</dd>
								</div>
							))}
						</dl>
					) : null}
				</details>
			) : null}
		</div>
	)
}

export function ScenarioDetailContent({
	scenario,
	protocol,
	supplyUsd,
	stress,
	layout = 'stack'
}: {
	scenario: ScenarioVM
	protocol: ProtocolRiskFixture | null
	supplyUsd: number
	stress?: StressSel
	layout?: 'stack' | 'two-column'
}) {
	if (layout === 'two-column') {
		return (
			<div className="grid gap-5 lg:grid-cols-[1fr_3fr]">
				<LossBox scenario={scenario} supplyUsd={supplyUsd} stress={stress} />
				<NarrativeBody scenario={scenario} protocol={protocol} />
			</div>
		)
	}
	return (
		<div className="flex flex-col gap-4">
			<LossBox scenario={scenario} supplyUsd={supplyUsd} stress={stress} />
			<NarrativeBody scenario={scenario} protocol={protocol} />
		</div>
	)
}
