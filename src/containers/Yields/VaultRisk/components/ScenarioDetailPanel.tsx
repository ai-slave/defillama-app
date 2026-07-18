import { TokenPageTableShell } from '~/components/Table/helpers'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { formattedNum } from '~/utils'
import { scenarioTone } from '../derive'
import { guardianText } from '../format'
import { oracleBadge, toneClasses } from '../kindMeta'
import { RiskCallout } from '../primitives/RiskCallout'
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
			className={`-mx-1.5 flex items-center justify-between gap-3 rounded-md px-1.5 py-1 ${active ? 'bg-brand-muted' : ''}`}
		>
			<span className={`body-sm ${active ? 'text-primary' : 'text-secondary'}`}>{label}</span>
			<span className={`label-sm tabular-nums ${active ? 'text-primary' : muted ? 'text-secondary' : 'text-primary'}`}>
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
			<circle cx="9" cy="9" r={r} fill="none" strokeWidth={strokeWidth} className="stroke-(--border-subtle)" />
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
				<span className="body-sm text-secondary">{title}</span>
				<span className={`mono-xl tabular-nums ${muted ? 'text-secondary' : 'text-primary'}`}>{amount}</span>
				{note ? <span className="mt-0.5 body-sm text-secondary">{note}</span> : null}
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
			<p className="mt-2 body-sm text-secondary">Shown for your {formattedNum(position, true)} deposit.</p>
		) : null
	if (scenario.status !== 'computed') {
		return (
			<Card padding="md" className="flex flex-col self-start">
				<p className="body-sm text-secondary">Modeled loss</p>
				<p className="mt-1 heading-sm text-secondary">Not quantified</p>
				<div className="mt-3 border-t border-subtle pt-3">
					<StatRow label="Exit window" value={exit} />
				</div>
			</Card>
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
			<p className="mt-2 body-sm text-secondary">Capped at pool size: you can&apos;t lose more than is deposited.</p>
		) : null

	if (scenario.lossByAnchor?.length) {
		const headlineMuted = cell.amount === '$0' || cell.amount === '—'
		return (
			<Card padding="md" className="flex flex-col self-start">
				<LossHero
					title={stressLossTitle(scenario, stress)}
					amount={heroAmount}
					note={cell.note}
					pct={ringPct}
					toneText={tone.text}
					muted={headlineMuted}
				/>
				<div className="mt-3 flex flex-col gap-0.5 border-t border-subtle pt-3">
					<p className="mb-0.5 body-sm text-secondary">As collateral falls</p>
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
				<div className="mt-3 border-t border-subtle pt-3">
					<StatRow label="Exit window" value={exit} />
				</div>
				{cappedNote}
				{positionNote}
			</Card>
		)
	}

	// No per-drop curve: a worst-case-only scenario leads with the ceiling, not a bare "—".
	const worstOnly = cell.amount === '—'
	return (
		<Card padding="md" className="flex flex-col self-start">
			<LossHero
				title={worstOnly ? 'Worst case' : stressLossTitle(scenario, stress)}
				amount={worstOnly ? worstValue : heroAmount}
				pct={worstOnly ? 100 : ringPct}
				toneText={tone.text}
				muted={!worstOnly && cell.amount === '$0'}
			/>
			{!worstOnly ? (
				<div className="mt-3 border-t border-subtle pt-3">
					<StatRow label="Worst case" value={worstValue} />
				</div>
			) : null}
			<div className="mt-3 border-t border-subtle pt-3">
				<StatRow label="Exit window" value={exit} />
			</div>
			{cappedNote}
			{positionNote}
		</Card>
	)
}

function PerAssetTable({ scenario }: { scenario: ScenarioVM }) {
	if (!scenario.perAsset?.length) return null
	return (
		<TokenPageTableShell>
			<table className="w-full">
				<thead className="bg-surface text-sm font-medium text-secondary">
					<tr>
						<th className="px-3 py-2 text-left">Asset</th>
						<th className="px-3 py-2 text-left">Oracle</th>
						<th className="px-3 py-2 text-right">Max loss</th>
					</tr>
				</thead>
				<tbody>
					{scenario.perAsset.slice(0, 12).map((a) => (
						<tr key={a.address} className="border-t border-subtle">
							<td className="px-3 py-2 label-md text-primary">{a.symbol}</td>
							<td className="px-3 py-2 text-secondary">{a.oracleType ? oracleBadge(a.oracleType).label : '—'}</td>
							<td className="px-3 py-2 text-right label-md text-primary">{formattedNum(a.lossMaxUsd, true)}</td>
						</tr>
					))}
				</tbody>
			</table>
			{scenario.perAsset.length > 12 ? (
				<p className="px-3 py-2 body-md text-secondary">+{scenario.perAsset.length - 12} more assets</p>
			) : null}
		</TokenPageTableShell>
	)
}

function RealizedStrip({ scenario }: { scenario: ScenarioVM }) {
	if (!scenario.realized?.incidents?.length) return null
	return (
		<RiskCallout>
			<p className="flex items-center gap-1.5 label-md text-(--yield-warning-text)">
				<Icon name="flame" className="size-4" />
				This has actually happened
			</p>
			<ul className="mt-2 space-y-1.5">
				{scenario.realized.incidents.map((inc) => {
					const madeWhole = inc.usd_recovered >= inc.usd_lost && inc.usd_lost > 0
					return (
						<li
							key={`${inc.date}:${inc.usd_lost}:${inc.usd_recovered}:${inc.post_mortem_url ?? ''}`}
							className="flex flex-wrap items-center gap-x-2 body-md text-secondary"
						>
							<span>{inc.date}</span>
							<span>
								{formattedNum(inc.usd_lost, true)} lost
								{inc.usd_recovered > 0 ? (
									<>
										{' · '}
										<span className={madeWhole ? 'text-(--yield-positive-text)' : undefined}>
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
									className="inline-flex items-center gap-0.5 underline decoration-dotted hover:text-primary"
								>
									post-mortem <Icon name="external-link" className="size-3" />
								</a>
							) : null}
						</li>
					)
				})}
			</ul>
		</RiskCallout>
	)
}

function CoverageNote({ scenario }: { scenario: ScenarioVM }) {
	if (!scenario.coverage.length) return null
	const noEscape = scenario.actingWindow.kind === 'no-escape'
	return (
		<div className="flex flex-col gap-1.5">
			<p className="label-sm text-primary">What could cover it</p>
			<ul className="space-y-1.5">
				{scenario.coverage.map((c: CoverageVM) => (
					<li
						key={`${c.kind}:${c.access}:${c.rawCapUsd}:${c.excludesOwnTokens}`}
						className="flex flex-wrap items-center gap-x-2 body-md text-secondary"
					>
						<span className="label-md text-primary">{formattedNum(c.capUsd, true)}</span>
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
			<p className="label-sm text-primary">Who can pull the trigger</p>
			<p className="body-md text-secondary">{parts.join(' · ')}</p>
		</div>
	)
}

// For a data_gap the missing-data reason IS the answer; computed scenarios put their
// methodology caveat under "The math" instead.
function ReasonNote({ scenario }: { scenario: ScenarioVM }) {
	if (scenario.status === 'computed') return null
	return (
		<Card padding="md">
			<p className="label-sm text-primary">Why this isn&apos;t quantified</p>
			<p className="mt-1 body-md text-secondary">
				Current on-chain inputs identify the scenario, but don&apos;t contain enough exposure data to size depositor
				impact.
			</p>
			{scenario.notes ? <p className="mt-1.5 body-md text-secondary">{scenario.notes}</p> : null}
		</Card>
	)
}

function NarrativeBody({ scenario, protocol }: { scenario: ScenarioVM; protocol: ProtocolRiskFixture | null }) {
	return (
		<div className="flex flex-col gap-4">
			{scenario.oneLiner ? (
				<div className="flex flex-col gap-1.5">
					<p className="label-sm text-primary">What happens</p>
					<p className="max-w-[68ch] body-md text-secondary">{scenario.oneLiner}</p>
				</div>
			) : null}
			<ReasonNote scenario={scenario} />
			<RealizedStrip scenario={scenario} />
			<PerAssetTable scenario={scenario} />

			{scenario.conditions ? (
				<div className="flex flex-col gap-1.5">
					<p className="label-sm text-primary">Why it happens</p>
					<ConditionsTree conditions={scenario.conditions} protocol={protocol} />
				</div>
			) : null}

			<WhoCanDoThis scenario={scenario} protocol={protocol} />

			{scenario.mitigations.length ? (
				<div className="flex flex-col gap-1.5">
					<p className="label-sm text-primary">What softens it</p>
					<ul className="list-disc space-y-1 pl-5 body-md marker:text-data-up">
						{scenario.mitigations.map((mitigation) => (
							<li key={mitigation} className="text-secondary">
								{mitigation}
							</li>
						))}
					</ul>
				</div>
			) : null}

			<CoverageNote scenario={scenario} />

			{scenario.evidence.length ? (
				<div className="flex flex-col gap-1.5">
					<p className="label-sm text-primary">Evidence</p>
					<ul className="space-y-1">
						{scenario.evidence.map((e) => (
							<li key={`${e.url}:${e.kind}:${e.title ?? ''}:${e.date ?? ''}:${e.note ?? ''}`}>
								<a
									href={e.url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 body-md text-secondary underline decoration-dotted hover:text-primary"
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
				<Card as="details" padding="sm">
					<summary className="flex cursor-pointer list-none items-center justify-between gap-2 body-md text-secondary">
						<span>The math{scenario.formula ? ` · ${scenario.formula}` : ''}</span>
						<Icon name="chevron-down" className="size-3.5 transition-transform in-[[open]]:rotate-180" />
					</summary>
					{scenario.status === 'computed' && scenario.notes ? (
						<p className="mt-2 body-sm text-secondary italic">{scenario.notes}</p>
					) : null}
					{Object.keys(scenario.inputs).length ? (
						<dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
							{Object.entries(scenario.inputs).map(([k, v]) => (
								<div key={k} className="flex justify-between gap-2 body-md">
									<dt className="text-secondary">{k}</dt>
									<dd className="text-secondary">{typeof v === 'number' ? formattedNum(v, false) : String(v)}</dd>
								</div>
							))}
						</dl>
					) : null}
				</Card>
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
			<div className="grid gap-4 lg:grid-cols-[1fr_3fr]">
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
