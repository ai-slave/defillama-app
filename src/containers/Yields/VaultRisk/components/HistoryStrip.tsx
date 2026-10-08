import { useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { formatUsd } from '~/utils/numberFormat'
import { formatVerified } from '../format'
import { ExternalLink } from '../primitives/ExternalLink'
import { EASE_OUT_EXPO, useInViewOnce } from '../primitives/motion'
import type { Audit } from '../types'

// Track record on one time axis, three lanes that must never be conflated: pool incidents
// (this vault's OWN losses), protocol incidents (context, never pool-level), and audits.

const YEAR_MS = 365.25 * 24 * 3600 * 1000
const DETAIL_ID = 'history-strip-detail'
const CLUSTER_W = 3 // % of the axis — audits closer than this merge into one chip

// Lane geometry, % of the strip height (h-24).
const POOL_CY = 15
const PROTO_CY = 37
const AXIS_Y = 60

export interface HistoryIncident {
	date: string
	usdLost: number
	usdRecovered: number | null
	postMortemUrl?: string
	title: string
}

// `contextLabel` is the honest "this isn't your pool" line; `classification` drives it.
export interface ProtocolIncidentInput {
	date: string
	kind: string
	classification: string
	chain: string
	technique: string
	usdLost: number
	usdRecovered: number
	fullyRecovered: boolean
	postMortemUrl: string | null
	notes?: string
}

export interface IncidentPoint {
	key: string
	x: number // % across the strip
	r: number // radius px, area-ish scaled by dollars
	tone: 'loss' | 'made-whole' | 'averted'
	title: string
	money: string // the dollar story, one sentence
	label: string // full tooltip/aria sentence
	url?: string
	date: string
}

export interface ProtocolIncidentPoint {
	key: string
	x: number
	r: number
	recovered: boolean // made whole or averted — drives the hollow dot's accent
	classification: string
	title: string
	money: string
	technique?: string
	contextLabel: string // "Protocol-level incident — not recorded on this vault"
	label: string // full tooltip/aria sentence
	url?: string
	date: string
}

export interface AuditCluster {
	key: string
	x: number
	count: number
	from: string
	to: string
	items: Array<{ key: string; firm: string; date: string; url?: string }>
}

export interface HistoryStripVM {
	incidents: Array<IncidentPoint>
	protocolIncidents: Array<ProtocolIncidentPoint>
	audits: Array<AuditCluster>
	years: Array<{ x: number; label: string }>
}

function parseTs(d?: string): number | null {
	const t = Date.parse(d ?? '')
	return Number.isNaN(t) ? null : t
}

// "oracle-misconfiguration" → "Oracle misconfiguration"
function humanizeKind(kind: string): string {
	const s = kind.replace(/[-_]/g, ' ')
	return s.charAt(0).toUpperCase() + s.slice(1)
}

const CLASSIFICATION_CONTEXT: Record<string, string> = {
	protocol: 'Protocol-level incident — not recorded on this vault',
	ecosystem: 'Ecosystem / app incident — not recorded on this vault',
	collateral: 'Collateral incident in another market — not recorded on this vault'
}

function classificationContext(c: string): string {
	return CLASSIFICATION_CONTEXT[c] ?? 'Protocol-wide incident — not recorded on this vault'
}

// One dollar sentence, shared by both lanes.
function moneyStory(usdLost: number, usdRecovered: number | null, madeWhole: boolean): string {
	if (usdRecovered === null) {
		return `${formatUsd(usdLost, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} lost, recovery unavailable`
	}
	if (usdLost <= 0 && usdRecovered > 0) {
		return `${formatUsd(usdRecovered, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} returned before depositors lost anything`
	}
	return `${formatUsd(usdLost, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} lost${
		usdRecovered > 0
			? `, ${formatUsd(usdRecovered, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} recovered${madeWhole ? ' (made whole)' : ''}`
			: ', not recovered'
	}`
}

// Pure layout, exported for tests. `nowIso` anchors the right edge deterministically so SSR
// and client render identically; protocol incidents are sized within their own lane.
export function buildHistoryStrip(
	audits: Array<Audit>,
	incidents: Array<HistoryIncident>,
	protocolIncidents: Array<ProtocolIncidentInput>,
	nowIso?: string
): HistoryStripVM | null {
	const auditTs = audits
		.map((a) => ({ ts: parseTs(a.date), a }))
		.filter((e): e is { ts: number; a: Audit } => e.ts != null)
		.sort((a, b) => a.ts - b.ts)
	const incidentTs = incidents
		.map((i) => ({ ts: parseTs(i.date), i }))
		.filter((e): e is { ts: number; i: HistoryIncident } => e.ts != null)
		.sort((a, b) => a.ts - b.ts)
	const protoTs = protocolIncidents
		.map((i) => ({ ts: parseTs(i.date), i }))
		.filter((e): e is { ts: number; i: ProtocolIncidentInput } => e.ts != null)
		.sort((a, b) => a.ts - b.ts)
	if (auditTs.length === 0 && incidentTs.length === 0 && protoTs.length === 0) return null

	const all = [...auditTs.map((e) => e.ts), ...incidentTs.map((e) => e.ts), ...protoTs.map((e) => e.ts)]
	const now = parseTs(nowIso)
	let min = Math.min(...all)
	let max = Math.max(...all, now ?? -Infinity)
	if (max - min < YEAR_MS / 2) {
		// A lone event (or a tight cluster) still deserves a readable axis.
		min -= YEAR_MS / 2
		max += YEAR_MS / 4
	}
	const x = (t: number) => 2 + ((t - min) / (max - min)) * 96

	const maxUsd = Math.max(1, ...incidentTs.map((e) => Math.max(e.i.usdLost, e.i.usdRecovered ?? 0)))
	const incidentPts: Array<IncidentPoint> = incidentTs.map(({ ts, i }, idx) => {
		const recovered = i.usdRecovered ?? 0
		const averted = i.usdRecovered !== null && i.usdLost <= 0 && recovered > 0
		const madeWhole = i.usdRecovered !== null && !averted && i.usdLost > 0 && recovered >= i.usdLost
		const money = moneyStory(i.usdLost, i.usdRecovered, madeWhole)
		return {
			key: `inc-${idx}`,
			x: x(ts),
			r: 5 + 6 * Math.sqrt(Math.max(i.usdLost, recovered) / maxUsd),
			tone: averted ? 'averted' : madeWhole ? 'made-whole' : 'loss',
			title: i.title,
			money,
			label: `${formatVerified(i.date)} · ${i.title} · ${money}`,
			...(i.postMortemUrl ? { url: i.postMortemUrl } : {}),
			date: i.date
		}
	})

	const maxProtoUsd = Math.max(1, ...protoTs.map((e) => Math.max(e.i.usdLost, e.i.usdRecovered)))
	const protoPts: Array<ProtocolIncidentPoint> = protoTs.map(({ ts, i }, idx) => {
		const averted = i.usdLost <= 0 && i.usdRecovered > 0
		const madeWhole = i.fullyRecovered || (i.usdLost > 0 && i.usdRecovered >= i.usdLost)
		const money = moneyStory(i.usdLost, i.usdRecovered, madeWhole)
		const title = humanizeKind(i.kind)
		const contextLabel = classificationContext(i.classification)
		return {
			key: `pinc-${idx}`,
			x: x(ts),
			r: 4 + 5 * Math.sqrt(Math.max(i.usdLost, i.usdRecovered) / maxProtoUsd),
			recovered: averted || madeWhole,
			classification: i.classification,
			title,
			money,
			technique: i.technique,
			contextLabel,
			label: `${formatVerified(i.date)} · ${title} (${contextLabel}) · ${money}`,
			...(i.postMortemUrl ? { url: i.postMortemUrl } : {}),
			date: i.date
		}
	})

	// Greedy clustering: an audit within CLUSTER_W of the cluster's start joins it.
	const clusters: Array<AuditCluster> = []
	let current: {
		startX: number
		lastX: number
		items: AuditCluster['items']
	} | null = null
	const flush = () => {
		if (!current) return
		clusters.push({
			key: `aud-${clusters.length}`,
			x: (current.startX + current.lastX) / 2,
			count: current.items.length,
			from: current.items[0]!.date,
			to: current.items[current.items.length - 1]!.date,
			items: current.items
		})
		current = null
	}
	for (const {
		item: { ts, a },
		key
	} of keyedOccurrences(auditTs, ({ a }) => JSON.stringify([a.report.value, a.scope, a.version, a.commit_hash]))) {
		const px = x(ts)
		if (current && px - current.startX <= CLUSTER_W) {
			current.lastX = px
			current.items.push({ key, firm: a.firm, date: a.date, url: a.report.value })
		} else {
			flush()
			current = {
				startX: px,
				lastX: px,
				items: [{ key, firm: a.firm, date: a.date, url: a.report.value }]
			}
		}
	}
	flush()

	const fromYear = new Date(min).getUTCFullYear() + 1
	const toYear = new Date(max).getUTCFullYear()
	const step = Math.max(1, Math.ceil((toYear - fromYear + 1) / 6))
	const years: HistoryStripVM['years'] = []
	for (let y = fromYear; y <= toYear; y += step) {
		years.push({ x: x(Date.UTC(y, 0, 1)), label: String(y) })
	}

	return { incidents: incidentPts, protocolIncidents: protoPts, audits: clusters, years }
}

const INCIDENT_TONE: Record<IncidentPoint['tone'], string> = {
	loss: 'border-data-down-strong bg-data-down-tint-strong',
	'made-whole': 'border-data-up bg-data-up-tint-strong',
	averted: 'border-data-up border-dashed bg-data-up-tint-strong'
}

const INCIDENT_TONE_TEXT: Record<IncidentPoint['tone'], { label: string; className: string }> = {
	loss: { label: 'not recovered', className: 'text-(--yield-negative-text)' },
	'made-whole': { label: 'made whole', className: 'text-(--yield-positive-text)' },
	averted: { label: 'averted', className: 'text-(--yield-positive-text)' }
}

function IncidentDot({ p, selected, onToggle }: { p: IncidentPoint; selected: boolean; onToggle: () => void }) {
	return (
		<>
			{/* stem ties the dot to its date on the axis */}
			<span
				aria-hidden
				className="absolute w-px -translate-x-1/2 bg-border-subtle"
				style={{
					left: `${p.x}%`,
					top: `calc(${POOL_CY}% + ${p.r}px)`,
					height: `calc(${AXIS_Y - POOL_CY}% - ${p.r}px)`
				}}
			/>
			<Tooltip
				content={p.label}
				render={
					<button
						type="button"
						onClick={onToggle}
						aria-expanded={selected}
						aria-controls={selected ? DETAIL_ID : undefined}
						aria-label={p.label}
						data-hs-pt
						className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border outline-offset-2 outline-brand transition-colors duration-150 focus-visible:outline-2 ${INCIDENT_TONE[p.tone]} ${
							selected ? 'ring-2 ring-brand' : ''
						}`}
						style={{
							left: `${p.x}%`,
							top: `${POOL_CY}%`,
							width: p.r * 2,
							height: p.r * 2
						}}
					/>
				}
			>
				<span className="sr-only">{p.label}</span>
			</Tooltip>
		</>
	)
}

// Protocol incidents read as context, never as this vault's loss: hollow dashed dots in
// their own lane.
function ProtocolIncidentDot({
	p,
	selected,
	onToggle
}: {
	p: ProtocolIncidentPoint
	selected: boolean
	onToggle: () => void
}) {
	return (
		<>
			<span
				aria-hidden
				className="absolute w-px -translate-x-1/2 border-l border-dashed border-subtle"
				style={{
					left: `${p.x}%`,
					top: `calc(${PROTO_CY}% + ${p.r}px)`,
					height: `calc(${AXIS_Y - PROTO_CY}% - ${p.r}px)`
				}}
			/>
			<Tooltip
				content={p.label}
				render={
					<button
						type="button"
						onClick={onToggle}
						aria-expanded={selected}
						aria-controls={selected ? DETAIL_ID : undefined}
						aria-label={p.label}
						data-hs-pt
						className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed bg-surface outline-offset-2 outline-brand transition-colors duration-150 focus-visible:outline-2 ${
							p.recovered ? 'border-data-up-strong' : 'border-secondary'
						} ${selected ? 'ring-2 ring-brand' : ''}`}
						style={{
							left: `${p.x}%`,
							top: `${PROTO_CY}%`,
							width: p.r * 2,
							height: p.r * 2
						}}
					/>
				}
			>
				<span className="sr-only">{p.label}</span>
			</Tooltip>
		</>
	)
}

function AuditChip({ c, selected, onToggle }: { c: AuditCluster; selected: boolean; onToggle: () => void }) {
	const range = c.from === c.to ? formatVerified(c.from) : `${formatVerified(c.from)} – ${formatVerified(c.to)}`
	const label = c.count === 1 ? `${c.items[0]!.firm} audit · ${range}` : `${c.count} audits · ${range}`
	return (
		<Tooltip
			content={label}
			render={
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={selected}
					aria-controls={selected ? DETAIL_ID : undefined}
					aria-label={label}
					data-hs-pt
					className={`absolute flex min-h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-sm border px-1 label-sm outline-offset-2 outline-brand transition-colors duration-150 focus-visible:outline-2 ${
						selected
							? 'border-brand bg-brand-tint text-link'
							: 'border-medium bg-surface text-secondary hover:border-strong hover:text-primary'
					}`}
					style={{ left: `${c.x}%`, top: `calc(${AXIS_Y}% + 5px)` }}
				/>
			}
		>
			{c.count}
		</Tooltip>
	)
}

type Selection =
	| { kind: 'incident'; p: IncidentPoint }
	| { kind: 'protocol'; p: ProtocolIncidentPoint }
	| { kind: 'audits'; c: AuditCluster }

function DetailPanel({ selection, onClose }: { selection: Selection; onClose: () => void }) {
	const title =
		selection.kind === 'incident'
			? `${selection.p.title} · ${formatVerified(selection.p.date)}`
			: selection.kind === 'protocol'
				? `${selection.p.title} · ${formatVerified(selection.p.date)}`
				: selection.c.count === 1
					? `${selection.c.items[0]!.firm} audit · ${formatVerified(selection.c.from)}`
					: `${selection.c.count} audits · ${formatVerified(selection.c.from)} – ${formatVerified(selection.c.to)}`
	return (
		<Card padding="none" id={DETAIL_ID} role="region" aria-label={title}>
			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-subtle px-3 py-2">
				<span className="label-sm text-primary">{title}</span>
				{selection.kind === 'incident' ? (
					<span className={`body-sm ${INCIDENT_TONE_TEXT[selection.p.tone].className}`}>
						{INCIDENT_TONE_TEXT[selection.p.tone].label}
					</span>
				) : null}
				{selection.kind === 'protocol' ? (
					<span className="rounded-full border border-medium px-1.5 py-0.5 label-xs text-secondary uppercase">
						{selection.p.classification}
					</span>
				) : null}
				<Tooltip
					content="Close detail"
					render={
						<Button
							type="button"
							variant="ghost"
							size="sm"
							square
							onClick={onClose}
							aria-label="Close detail"
							className="-mr-1 ml-auto"
						/>
					}
				>
					<Icon name="x" className="size-4" />
				</Tooltip>
			</div>
			{selection.kind === 'incident' ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 body-sm text-secondary">
					<span>{selection.p.money}</span>
					{selection.p.url ? <ExternalLink href={selection.p.url}>post-mortem</ExternalLink> : null}
				</div>
			) : selection.kind === 'protocol' ? (
				<div className="flex flex-col gap-1 px-3 py-2 body-sm text-secondary">
					<span className="label-sm text-primary">{selection.p.contextLabel}</span>
					<span>{selection.p.money}</span>
					{selection.p.technique ? <span className="text-secondary">{selection.p.technique}</span> : null}
					{selection.p.url ? <ExternalLink href={selection.p.url}>post-mortem</ExternalLink> : null}
				</div>
			) : (
				<ul className="flex flex-col divide-y divide-(--border-subtle) px-3 py-1">
					{selection.c.items.map((a) => (
						<li key={a.key} className="flex items-center justify-between gap-3 py-1.5 body-sm">
							<span className="min-w-0 truncate text-secondary">
								<span className="text-primary">{a.firm}</span> · {formatVerified(a.date)}
							</span>
							{a.url ? <ExternalLink href={a.url}>report</ExternalLink> : null}
						</li>
					))}
				</ul>
			)}
		</Card>
	)
}

const EMPTY_PROTOCOL_INCIDENTS: Array<ProtocolIncidentInput> = []

export function HistoryStrip({
	audits,
	incidents,
	protocolIncidents = EMPTY_PROTOCOL_INCIDENTS,
	nowIso
}: {
	audits: Array<Audit>
	incidents: Array<HistoryIncident>
	protocolIncidents?: Array<ProtocolIncidentInput>
	nowIso?: string
}) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const vm = useMemo(
		() => buildHistoryStrip(audits, incidents, protocolIncidents, nowIso),
		[audits, incidents, protocolIncidents, nowIso]
	)

	const rootRef = useInViewOnce<HTMLDivElement>((root) => {
		for (const [i, el] of root.querySelectorAll<HTMLElement>('[data-hs-pt]').entries()) {
			el.animate(
				[
					{ opacity: 0, scale: '0.5' },
					{ opacity: 1, scale: '1' }
				],
				{
					duration: 350,
					delay: Math.min(i * 25, 400),
					easing: EASE_OUT_EXPO,
					fill: 'backwards'
				}
			)
		}
	})

	if (!vm) return null

	const selection: Selection | null = (() => {
		if (!selectedKey) return null
		const p = vm.incidents.find((i) => i.key === selectedKey)
		if (p) return { kind: 'incident', p }
		const pp = vm.protocolIncidents.find((i) => i.key === selectedKey)
		if (pp) return { kind: 'protocol', p: pp }
		const c = vm.audits.find((a) => a.key === selectedKey)
		return c ? { kind: 'audits', c } : null
	})()

	const auditCount = vm.audits.reduce((a, c) => a + c.count, 0)
	const losses = vm.incidents.filter((p) => p.tone === 'loss').length
	// Protocol-wide history stays a separate clause so an empty pool record never reads as
	// "the protocol is clean".
	const poolPart =
		vm.incidents.length > 0
			? `${vm.incidents.length} pool incident${vm.incidents.length === 1 ? '' : 's'}${
					losses === 0 ? ', depositors made whole every time' : ''
				}`
			: 'no pool-level losses recorded'
	const protoPart =
		vm.protocolIncidents.length > 0
			? ` · ${vm.protocolIncidents.length} protocol incident${vm.protocolIncidents.length === 1 ? '' : 's'}`
			: ''
	const summary = `${poolPart}${protoPart} · ${auditCount} audits`
	const toggle = (key: string) => setSelectedKey((v) => (v === key ? null : key))

	return (
		<div className="flex flex-col gap-1.5">
			<span className="label-sm text-primary">
				Track record <span className="font-normal text-secondary">· {summary}</span>
			</span>

			<div className="flex">
				<div className="relative w-14 shrink-0 body-xs text-secondary" aria-hidden>
					<span className="absolute right-2 -translate-y-1/2" style={{ top: `${POOL_CY}%` }}>
						pool
					</span>
					<span className="absolute right-2 -translate-y-1/2" style={{ top: `${PROTO_CY}%` }}>
						protocol
					</span>
					<span className="absolute right-2" style={{ top: `calc(${AXIS_Y}% + 5px)` }}>
						audits
					</span>
				</div>

				<div
					ref={rootRef}
					role="group"
					aria-label={`Track record timeline: ${summary}. Pool and protocol-wide incidents are separate lanes. Select a marker for detail.`}
					className="relative h-24 flex-1"
				>
					<div className="absolute inset-x-0 border-t border-subtle" style={{ top: `${AXIS_Y}%` }} aria-hidden />
					{vm.years.map((y) => (
						<span key={y.label} aria-hidden className="contents">
							<span
								className="absolute h-1 w-px -translate-x-1/2 bg-border-strong"
								style={{ left: `${y.x}%`, top: `calc(${AXIS_Y}% - 4px)` }}
							/>
							<span className="absolute bottom-0 -translate-x-1/2 body-xs text-secondary" style={{ left: `${y.x}%` }}>
								{y.label}
							</span>
						</span>
					))}
					{vm.audits.map((c) => (
						<AuditChip key={c.key} c={c} selected={selectedKey === c.key} onToggle={() => toggle(c.key)} />
					))}
					{vm.incidents.map((p) => (
						<IncidentDot key={p.key} p={p} selected={selectedKey === p.key} onToggle={() => toggle(p.key)} />
					))}
					{vm.protocolIncidents.map((p) => (
						<ProtocolIncidentDot key={p.key} p={p} selected={selectedKey === p.key} onToggle={() => toggle(p.key)} />
					))}
				</div>
			</div>

			{selection ? (
				<DetailPanel
					selection={selection}
					onClose={() => {
						// The detail leaves with its close button; the marker that opened it takes focus back.
						const marker = document.querySelector<HTMLElement>(`[aria-controls="${DETAIL_ID}"]`)
						keepFocus(
							() => setSelectedKey(null),
							() => marker
						)
					}}
				/>
			) : null}
		</div>
	)
}
