import { useMemo, useState } from 'react'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { prettyProtocolSlug } from '../format'
import type { ConditionNode, ExternalDependency, ScenarioVM } from '../types'
import { MICRO_LABEL } from './trustShared'

// Everything this protocol stands on that it doesn't control, drawn as a hub-and-spoke:
// dependencies grouped by kind into angular sectors, click a node for its context panel.
const DEP_KIND_LABEL: Record<string, string> = {
	'oracle-provider': 'oracles',
	sequencer: 'sequencers',
	'cross-chain-message-bus': 'bridges & messaging',
	'rpc-provider': 'infra',
	'collateral-inherited': 'via collateral'
}
const DEP_KIND_ORDER = [
	'oracle-provider',
	'sequencer',
	'cross-chain-message-bus',
	'rpc-provider',
	'collateral-inherited'
]
const SECTOR_GAP_DEG = 14

function collectRefs(node: ConditionNode | undefined, out: string[]): void {
	if (!node) return
	if (node.ref) out.push(node.ref)
	for (const child of node.children ?? []) collectRefs(child, out)
}

function depName(d: ExternalDependency): string {
	return prettyProtocolSlug((d.name || d.id).replace(/\./g, '-'))
}

interface DepNode {
	d: ExternalDependency
	count: number
	titles: string[]
	x: number // % within the map box
	y: number
}

interface SectorLabel {
	label: string
	x: number
	y: number
	translate: string // quadrant-aware anchor so labels extend outward, never under pills
}

// Wide ellipse with a two-ring stagger: alternating nodes step inward to separate
// horizontally-adjacent pills at the top and bottom of the ring.
const RX = 40
const RY = 38

// Fixed precision so SSR and the client emit identical inline-style/SVG values — raw
// Math.cos/sin differ by a ULP across engines and trip React's hydration text match.
const round3 = (n: number): number => Math.round(n * 1000) / 1000

function layoutDeps(deps: ExternalDependency[], scenarios: ScenarioVM[]): { nodes: DepNode[]; sectors: SectorLabel[] } {
	const scenarioRefs = scenarios.map((s) => {
		const refs: string[] = []
		collectRefs(s.conditions, refs)
		return { title: s.title, refs }
	})
	const byKind = new Map<string, ExternalDependency[]>()
	for (const d of deps) {
		const group = byKind.get(d.kind)
		if (group) group.push(d)
		else byKind.set(d.kind, [d])
	}
	const kinds = [...byKind.keys()].sort((a, b) => {
		const ia = DEP_KIND_ORDER.indexOf(a)
		const ib = DEP_KIND_ORDER.indexOf(b)
		return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
	})

	const usableDeg = 360 - kinds.length * SECTOR_GAP_DEG
	const nodes: DepNode[] = []
	const sectors: SectorLabel[] = []
	let cursor = -90 // start at 12 o'clock
	let globalIndex = 0
	for (const kind of kinds) {
		const group = byKind.get(kind)!
		const span = (group.length / deps.length) * usableDeg
		group.forEach((d, i) => {
			const angle = ((cursor + (span * (i + 0.5)) / group.length) * Math.PI) / 180
			const ring = globalIndex % 2 === 0 ? 1 : 0.74
			globalIndex++
			const matches = scenarioRefs.filter(({ refs }) => refs.some((ref) => ref === d.id || ref.startsWith(d.id + '.')))
			nodes.push({
				d,
				count: matches.length,
				titles: matches.map((m) => m.title),
				x: round3(50 + RX * ring * Math.cos(angle)),
				y: round3(50 + RY * ring * Math.sin(angle))
			})
		})
		const mid = ((cursor + span / 2) * Math.PI) / 180
		const cos = Math.cos(mid)
		const sin = Math.sin(mid)
		sectors.push({
			label: DEP_KIND_LABEL[kind] ?? kind,
			x: round3(50 + RX * 1.16 * cos),
			y: round3(50 + RY * 1.16 * sin),
			translate: `translate(${cos > 0.35 ? '0%' : cos < -0.35 ? '-100%' : '-50%'}, ${
				sin > 0.35 ? '0%' : sin < -0.35 ? '-100%' : '-50%'
			})`
		})
		cursor += span + SECTOR_GAP_DEG
	}
	return { nodes, sectors }
}

export function DependencyMap({
	deps,
	scenarios,
	protocolId
}: {
	deps: ExternalDependency[]
	scenarios: ScenarioVM[]
	protocolId: string
}) {
	const { nodes, sectors } = useMemo(() => layoutDeps(deps, scenarios), [deps, scenarios])
	const defaultId = useMemo(() => [...nodes].sort((a, b) => b.count - a.count)[0]?.d.id ?? null, [nodes])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const selected = nodes.find((n) => n.d.id === (selectedId ?? defaultId)) ?? nodes[0]
	if (!nodes.length) return null

	return (
		<div className="flex flex-col gap-2">
			<span className={MICRO_LABEL}>
				Dependencies that can affect your deposit{' '}
				<span className="font-normal text-(--legacy-text-secondary)">
					{`· ${deps.length} ${deps.length === 1 ? 'thing' : 'things'} this pool relies on but doesn't control — select one for its story`}
				</span>
			</span>

			<div className="grid items-center gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div className="relative h-100 w-full">
					{/* full-length spokes: the opaque pills sit on top and clip each line at their own edge */}
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
						{nodes.map((n) => (
							<line
								key={n.d.id}
								x1="50"
								y1="50"
								x2={n.x}
								y2={n.y}
								vectorEffect="non-scaling-stroke"
								className={
									selected?.d.id === n.d.id
										? 'stroke-(--legacy-primary)'
										: n.count
											? 'stroke-(--legacy-text-tertiary)'
											: 'stroke-(--legacy-cards-border)'
								}
								strokeWidth={selected?.d.id === n.d.id ? 1.5 : 1}
							/>
						))}
					</svg>

					{sectors.map((s) => (
						<span
							key={s.label}
							aria-hidden
							className="absolute text-[9px] tracking-wide whitespace-nowrap text-(--legacy-text-tertiary) uppercase"
							style={{
								left: `${s.x}%`,
								top: `${s.y}%`,
								transform: s.translate
							}}
						>
							{s.label}
						</span>
					))}

					<span
						className="absolute flex max-w-40 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-(--legacy-cards-border) bg-(--legacy-cards-bg) px-2.5 py-1 text-xs font-semibold text-(--legacy-text-primary)"
						style={{ left: '50%', top: '50%' }}
					>
						<TokenLogo name={protocolId} kind="token" size={16} />
						<span className="truncate">{prettyProtocolSlug(protocolId)}</span>
					</span>

					{nodes.map((n) => {
						const isSelected = selected?.d.id === n.d.id
						return (
							<button
								key={n.d.id}
								type="button"
								onClick={() => setSelectedId(n.d.id)}
								aria-pressed={isSelected}
								aria-label={`${depName(n.d)}${n.count ? `, appears in ${n.count} loss scenarios` : ''}`}
								className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border bg-(--legacy-bg-main) px-2 py-0.5 text-[11px] outline-offset-2 outline-(--legacy-primary) transition-colors duration-150 focus-visible:z-10 focus-visible:outline-2 ${
									isSelected
										? 'z-10 border-(--legacy-primary) text-(--legacy-primary)'
										: n.count
											? 'max-w-36 border-(--legacy-cards-border) text-(--legacy-text-primary) hover:z-10 hover:border-(--legacy-text-secondary)/40'
											: 'max-w-36 border-(--legacy-cards-border) text-(--legacy-text-secondary) hover:z-10 hover:border-(--legacy-text-secondary)/40'
								}`}
								style={{ left: `${n.x}%`, top: `${n.y}%` }}
							>
								<span className="truncate">{depName(n.d)}</span>
								{n.count ? <span className="text-[9px] tabular-nums opacity-70">{n.count}</span> : null}
							</button>
						)
					})}
				</div>

				{selected ? (
					<div
						role="region"
						aria-label={depName(selected.d)}
						className="flex flex-col gap-2 self-center rounded-md border border-(--legacy-cards-border) bg-(--legacy-bg-main) p-3"
					>
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0">
								<span className="text-[10px] tracking-wide text-(--legacy-text-secondary) uppercase">
									{DEP_KIND_LABEL[selected.d.kind] ?? selected.d.kind}
								</span>
								<h4 className="text-sm font-semibold text-(--legacy-text-primary)">{depName(selected.d)}</h4>
							</div>
							{selected.d.source_url ? (
								<a
									href={selected.d.source_url}
									target="_blank"
									rel="noreferrer"
									aria-label={`${depName(selected.d)} — open source`}
									className="flex shrink-0 items-center p-0.5 text-(--legacy-text-secondary) hover:text-(--legacy-text-primary)"
								>
									<Icon name="arrow-up-right" className="size-3.5" />
								</a>
							) : null}
						</div>
						{selected.d.description ? (
							<p className="text-xs text-(--legacy-text-secondary)">{selected.d.description}</p>
						) : null}
						{selected.d.notes ? (
							<p className="text-xs text-(--legacy-text-secondary) italic">{selected.d.notes}</p>
						) : null}
						{selected.titles.length ? (
							<div className="flex flex-col gap-1">
								<span className="text-xs font-semibold text-(--legacy-text-primary)">
									Tied to {selected.titles.length} loss scenario
									{selected.titles.length === 1 ? '' : 's'}
								</span>
								<ul className="flex flex-col gap-0.5">
									{selected.titles.map((t) => (
										<li key={t} className="text-xs text-(--legacy-text-secondary)">
											· {t}
										</li>
									))}
								</ul>
							</div>
						) : (
							<p className="text-xs text-(--legacy-text-tertiary) italic">
								No quantified loss scenario references this dependency directly.
							</p>
						)}
					</div>
				) : null}
			</div>
		</div>
	)
}
