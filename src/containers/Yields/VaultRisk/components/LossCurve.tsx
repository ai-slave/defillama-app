import { useMemo, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { tooltipSurfaceStyles } from '~/ui/Popover'
import { formattedNum } from '~/utils'
import { EASE_OUT_EXPO, useCountUp, useInViewOnce } from '../primitives/motion'
import type { CollateralVM, ScenarioVM, Stress, StressAnchor } from '../types'

interface LossMark {
	lossUsd: number
	cause: string
}

// The largest realistic (below-catastrophe) loss point: the worst depeg stress anchor when
// present, else the worst computed scenario. [] when nothing lands meaningfully below worst.
function realisticMarks(
	scenarios: ScenarioVM[],
	stress: Stress | null,
	supplyUsd: number,
	worstUsd: number
): LossMark[] {
	if (supplyUsd <= 0) return []
	const ceil = worstUsd > 0 ? worstUsd : supplyUsd
	const inBand = (usd: number) => usd > supplyUsd * 0.01 && usd < ceil * 0.95
	if (stress?.anchors?.length) {
		return stress.anchors
			.filter((a) => inBand(a.bad_debt_usd))
			.map((a) => ({ lossUsd: a.bad_debt_usd, cause: `−${a.drop_pct}% crash` }))
			.sort((x, y) => x.lossUsd - y.lossUsd)
	}
	const seen = new Set<number>()
	const out: LossMark[] = []
	for (const s of scenarios
		.filter((s) => s.status === 'computed' && inBand(s.lossMaxUsd))
		.sort((x, y) => y.lossMaxUsd - x.lossMaxUsd)) {
		const bucket = Math.round((s.lossMaxUsd / supplyUsd) * 20) // collapse near-equal levels
		if (seen.has(bucket)) continue
		seen.add(bucket)
		out.push({ lossUsd: s.lossMaxUsd, cause: s.title })
		if (out.length >= 2) break
	}
	return out.sort((x, y) => x.lossUsd - y.lossUsd)
}

// Monotone cubic spline (Fritsch–Carlson) as cubic Bézier segments — monotone so the loss
// data renders as a clean cliff, never a wiggle that dips below a point it passes through.
interface CubicSeg {
	p0: { x: number; y: number }
	c1: { x: number; y: number }
	c2: { x: number; y: number }
	p3: { x: number; y: number }
}

function splineSegs(pts: { x: number; y: number }[]): CubicSeg[] {
	const n = pts.length
	if (n < 2) return []
	const dx: number[] = []
	const slope: number[] = []
	for (let i = 0; i < n - 1; i++) {
		dx[i] = pts[i + 1].x - pts[i].x
		slope[i] = dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i]
	}
	const t = new Array<number>(n)
	t[0] = slope[0]
	t[n - 1] = slope[n - 2]
	for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
	for (let i = 0; i < n - 1; i++) {
		if (slope[i] === 0) {
			t[i] = 0
			t[i + 1] = 0
			continue
		}
		const a = t[i] / slope[i]
		const b = t[i + 1] / slope[i]
		const h = Math.hypot(a, b)
		if (h > 3) {
			const s = 3 / h
			t[i] = s * a * slope[i]
			t[i + 1] = s * b * slope[i]
		}
	}
	const segs: CubicSeg[] = []
	for (let i = 0; i < n - 1; i++) {
		segs.push({
			p0: pts[i],
			c1: { x: pts[i].x + dx[i] / 3, y: pts[i].y + (t[i] * dx[i]) / 3 },
			c2: { x: pts[i + 1].x - dx[i] / 3, y: pts[i + 1].y - (t[i + 1] * dx[i]) / 3 },
			p3: pts[i + 1]
		})
	}
	return segs
}

const round4 = (v: number) => Math.round(v * 10000) / 10000

function fwdPath(segs: CubicSeg[]): string {
	if (!segs.length) return ''
	let d = `M ${round4(segs[0].p0.x)} ${round4(segs[0].p0.y)}`
	for (const s of segs)
		d += ` C ${round4(s.c1.x)} ${round4(s.c1.y)} ${round4(s.c2.x)} ${round4(s.c2.y)} ${round4(s.p3.x)} ${round4(s.p3.y)}`
	return d
}

function areaPath(pts: { x: number; y: number }[], bottom = 100): { line: string; area: string } {
	const segs = splineSegs(pts)
	const line = fwdPath(segs)
	if (!segs.length) return { line: '', area: '' }
	const area = `${line} L ${round4(pts[pts.length - 1].x)} ${bottom} L ${round4(pts[0].x)} ${bottom} Z`
	return { line, area }
}

// The two figures that frame the loss: the realistic worst leads big, the catastrophe sits
// quiet to the right. Both count up on entrance and glide when a deposit rescales them.
function LossReadout({
	leadUsd,
	leadSub,
	catUsd,
	catSub,
	ratio
}: {
	leadUsd: number
	leadSub: string
	catUsd: number
	catSub: string
	ratio: number
}) {
	const fmt = (v: number) => formattedNum(v, true)
	const leadRef = useCountUp(leadUsd * ratio, fmt)
	const catRef = useCountUp(catUsd * ratio, fmt)
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
			<span className="flex flex-col">
				<span className="mono-xl text-primary tabular-nums">
					<span ref={leadRef}>{fmt(leadUsd * ratio)}</span>
				</span>
				<span className="body-sm text-secondary">{leadSub}</span>
			</span>
			<span className="flex flex-col text-right">
				<span className="label-md text-secondary tabular-nums">
					{'up to '}
					<span ref={catRef}>{fmt(catUsd * ratio)}</span>
				</span>
				<span className="body-sm text-tertiary">{catSub}</span>
			</span>
		</div>
	)
}

export interface LossVizProps {
	scenarios: ScenarioVM[]
	collateral: CollateralVM[]
	stress: Stress | null
	supplyUsd: number
	worstUsd: number
	worstTitle: string | null
	noEscape: boolean
	ratio: number
	personal: boolean
	position: number | null
	coverageUsd: number
}

// One modeled point on the curve and its position in the 0..100 box.
interface CurvePoint {
	drop: number
	loss: number
	x: number
	y: number
}

// CSS-pixel dots stay round at any width (an SVG pattern would smear under
// preserveAspectRatio="none").
const DOT_MASK = 'radial-gradient(circle at center, #000 1px, transparent 1.6px)'

const NO_ANCHORS: StressAnchor[] = []

// The loss curve: an axis-less scrubbable area — x is crash depth (0 → −100%), y dollars
// lost. Falls back to the two-figure readout when a pool has no depeg curve to plot.
export function LossCurve({
	scenarios,
	collateral,
	stress,
	supplyUsd,
	worstUsd,
	worstTitle,
	noEscape,
	ratio,
	personal,
	position,
	coverageUsd
}: LossVizProps) {
	const fmt = (usd: number) => formattedNum(usd * ratio, true)
	const share = (usd: number) => (supplyUsd > 0 ? Math.round((usd / supplyUsd) * 100) : 0)
	const catLabel = worstTitle ?? 'worst case'
	const whole = personal && position != null ? `~${formattedNum(position, true)}` : 'the full amount'
	const anchors = stress?.anchors ?? NO_ANCHORS

	const [active, setActive] = useState<number | null>(null)

	const rootRef = useInViewOnce<HTMLDivElement>((root) => {
		root
			.querySelector<HTMLElement>('[data-sweep]')
			?.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
				duration: 720,
				easing: EASE_OUT_EXPO,
				fill: 'backwards'
			})
		root.querySelectorAll<HTMLElement>('[data-annot]').forEach((el, i) =>
			el.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 260,
				delay: 480 + i * 60,
				easing: EASE_OUT_EXPO,
				fill: 'backwards'
			})
		)
	})

	// Geometry derived once per data change (scrubbing re-renders per pointer move). Null when
	// there's no depeg curve; kept above the early return so hook order is stable.
	const geom = useMemo(() => {
		if (anchors.length < 1 || worstUsd <= 0 || supplyUsd <= 0) return null
		const yMax = worstUsd
		const byDrop = new Map<number, number>([
			[0, 0],
			[100, yMax]
		])
		for (const a of anchors) byDrop.set(a.drop_pct, Math.min(a.bad_debt_usd, yMax))
		const pts = [...byDrop.entries()].map(([drop, loss]) => ({ drop, loss })).sort((x, y) => x.drop - y.drop)
		const coords = pts.map((p) => ({ x: p.drop, y: 100 - (p.loss / yMax) * 100 }))
		const { line, area } = areaPath(coords)
		// same shape in objectBoundingBox units (0..1) so an HTML dot layer can be clipped to it
		const areaClip = areaPath(
			coords.map((c) => ({ x: c.x / 100, y: c.y / 100 })),
			1
		).area

		const curvePts: CurvePoint[] = pts
			.filter((p) => p.drop > 0)
			.map((p) => ({ drop: p.drop, loss: p.loss, x: p.drop, y: 100 - (p.loss / yMax) * 100 }))

		const collByAddr = new Map(collateral.map((c) => [c.address.toLowerCase(), c]))

		// the realistic worst: the deepest anchor still meaningfully below the catastrophe
		const realisticAnchor =
			[...anchors]
				.filter((a) => a.bad_debt_usd > supplyUsd * 0.01 && a.bad_debt_usd < yMax * 0.95)
				.sort((x, y) => y.bad_debt_usd - x.bad_debt_usd)[0] ?? anchors[anchors.length - 1]

		return { line, area, areaClip, curvePts, collByAddr, realisticAnchor }
	}, [anchors, worstUsd, supplyUsd, collateral])

	// No depeg curve to plot (markets / flat-loss pools) → the two figures alone.
	if (!geom) {
		const marks = realisticMarks(scenarios, stress, supplyUsd, worstUsd)
		const realistic = marks[marks.length - 1]
		if (!realistic)
			return (
				<p className="body-md text-secondary">
					{'Every modeled failure here risks '}
					<span className="text-primary">{whole}</span>
					{' — there’s no smaller-loss path. Worst case: '}
					<span className="text-primary">
						{catLabel}
						{noEscape ? ' (no warning to exit)' : ''}
					</span>
					.
				</p>
			)
		return (
			<LossReadout
				leadUsd={realistic.lossUsd}
				leadSub={`realistic worst · ${realistic.cause}`}
				catUsd={worstUsd}
				catSub={`${catLabel} · extreme only`}
				ratio={ratio}
			/>
		)
	}

	const yMax = worstUsd
	const { line, area, areaClip, curvePts, collByAddr, realisticAnchor } = geom

	// Per-collateral split at a crash depth, summing to the point's total: depeg anchors carry
	// it directly; the catastrophe (drop 100) is whole-vault, not attributable to collateral.
	const logoFor = (symbol: string, address: string) =>
		collByAddr.get(address.toLowerCase())?.logoUrl ?? collateral.find((c) => c.symbol === symbol)?.logoUrl ?? null
	const breakdownAt = (drop: number, total: number): { symbol: string; usd: number; logoUrl: string | null }[] => {
		if (drop >= 100) return []
		const raw = (anchors.find((a) => a.drop_pct === drop)?.by_collateral ?? [])
			.map((c) => ({ symbol: c.symbol, usd: c.bad_debt_usd, logoUrl: logoFor(c.symbol, c.address) }))
			.filter((e) => e.usd > 0)
		raw.sort((a, b) => b.usd - a.usd)
		const top = raw.slice(0, 3)
		const otherUsd = total - top.reduce((s, e) => s + e.usd, 0)
		if (otherUsd > total * 0.005) top.push({ symbol: 'Other', usd: otherUsd, logoUrl: null })
		return top
	}

	// committed coverage drawn across the curve: below it the backstop covers, above it exposed
	const covY = coverageUsd > 0 && coverageUsd < yMax * 0.97 ? 100 - (coverageUsd / yMax) * 100 : null

	const aria = `Loss against collateral crash severity on ${formattedNum(supplyUsd * ratio, true)}: ${curvePts
		.filter((p) => p.drop < 100)
		.map((p) => `at −${p.drop}% about ${fmt(p.loss)}`)
		.join(', ')}; only an extreme event reaches a total ${fmt(yMax)}.`

	const scrub = (clientX: number, el: HTMLElement) => {
		const rect = el.getBoundingClientRect()
		const rx = (Math.max(0, Math.min(rect.width, clientX - rect.left)) / rect.width) * 100
		let best = 0
		let bestD = Infinity
		curvePts.forEach((p, i) => {
			const d = Math.abs(p.x - rx)
			if (d < bestD) {
				bestD = d
				best = i
			}
		})
		setActive(best)
	}
	// Keyboard scrub (WAI-ARIA slider): arrows step through the same modeled points the
	// pointer snaps to; blur clears, matching pointer-leave.
	const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		let next: number | null
		if (e.key === 'ArrowRight') next = Math.min((active ?? -1) + 1, curvePts.length - 1)
		else if (e.key === 'ArrowLeft') next = Math.max((active ?? curvePts.length) - 1, 0)
		else if (e.key === 'Home') next = 0
		else if (e.key === 'End') next = curvePts.length - 1
		else if (e.key === 'Escape') next = null
		else return
		e.preventDefault()
		setActive(next)
	}

	const hot = active != null ? curvePts[active] : null
	const hotBreakdown = hot ? breakdownAt(hot.drop, hot.loss) : []
	const valueText = hot
		? `${hot.drop >= 100 ? 'Extreme event' : `−${hot.drop}% collateral crash`}: est. loss ${fmt(hot.loss)} (${share(hot.loss)}% of deposit)`
		: 'No point selected — arrow keys step through the modeled crash depths'
	// popover flips below when the point is near the top and anchors by x so it never runs off
	const popTransformX = hot ? (hot.x < 22 ? '0%' : hot.x > 78 ? '-100%' : '-50%') : '-50%'
	const popBelow = hot ? hot.y < 45 : false

	return (
		<div className="flex flex-col gap-2">
			<LossReadout
				leadUsd={realisticAnchor.bad_debt_usd}
				leadSub={`realistic worst · −${realisticAnchor.drop_pct}% collateral crash`}
				catUsd={yMax}
				catSub={`${catLabel} · extreme only`}
				ratio={ratio}
			/>
			<div
				ref={rootRef}
				role="slider"
				tabIndex={0}
				aria-label={aria}
				aria-orientation="horizontal"
				aria-valuemin={0}
				aria-valuemax={curvePts.length - 1}
				aria-valuenow={active ?? 0}
				aria-valuetext={valueText}
				className="relative h-24 w-full cursor-crosshair rounded-md outline-offset-2 outline-brand focus-visible:outline-2 sm:h-28"
				onKeyDown={onKeyDown}
				onBlur={() => setActive(null)}
				onPointerMove={(e) => scrub(e.clientX, e.currentTarget)}
				onPointerDown={(e) => scrub(e.clientX, e.currentTarget)}
				onPointerLeave={() => {
					setActive(null)
				}}
			>
				<div data-sweep className="absolute inset-0">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
						<defs>
							<linearGradient id="vault-loss-grad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--bg-brand)" stopOpacity="0.3" />
								<stop offset="100%" stopColor="var(--bg-brand)" stopOpacity="0" />
							</linearGradient>
							<clipPath id="vault-area-clip" clipPathUnits="objectBoundingBox">
								<path d={areaClip} />
							</clipPath>
						</defs>
						<path d={area} fill="url(#vault-loss-grad)" />
						<path
							d={line}
							fill="none"
							stroke="var(--bg-brand)"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
							style={{ filter: 'drop-shadow(0 1px 5px color-mix(in oklch, var(--bg-brand) 30%, transparent))' }}
						/>
					</svg>
					{/* dot texture: a wash revealed through a dot-grid mask, clipped to the curve */}
					<div
						aria-hidden
						className="absolute inset-0"
						style={{
							background: 'var(--bg-brand)',
							opacity: 0.4,
							WebkitMaskImage: DOT_MASK,
							maskImage: DOT_MASK,
							WebkitMaskSize: '7px 7px',
							maskSize: '7px 7px',
							clipPath: 'url(#vault-area-clip)',
							WebkitClipPath: 'url(#vault-area-clip)'
						}}
					/>
				</div>

				{covY != null ? (
					<>
						<span
							data-annot
							aria-hidden
							className="pointer-events-none absolute inset-x-0 border-t border-dashed border-(--text-secondary)/40"
							style={{ top: `${covY}%` }}
						/>
						<span
							data-annot
							className="pointer-events-none absolute right-0 -translate-y-1/2 bg-surface pl-1 body-xs text-(--yield-positive-text)"
							style={{ top: `${covY}%` }}
						>
							{`covered to ${fmt(coverageUsd)}`}
						</span>
					</>
				) : null}

				{hot ? (
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 w-px bg-(--text-secondary)/30"
						style={{ left: `${hot.x}%` }}
					/>
				) : null}

				{curvePts.map((p, i) => (
					<span
						key={p.drop}
						data-annot
						aria-hidden
						className={`pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-transform duration-150 ${
							i === active ? 'scale-[1.8] bg-(--text-primary)' : 'bg-brand'
						}`}
						style={{ left: `${p.x}%`, top: `${p.y}%` }}
					/>
				))}

				{hot ? (
					<div
						className={`${tooltipSurfaceStyles} pointer-events-none absolute z-10 w-max max-w-56 p-2`}
						style={{
							left: `${hot.x}%`,
							top: `${hot.y}%`,
							transform: `translate(${popTransformX}, ${popBelow ? '14px' : 'calc(-100% - 14px)'})`
						}}
					>
						<div className="label-sm text-primary">
							{hot.drop >= 100 ? 'Extreme event' : `−${hot.drop}% collateral crash`}
						</div>
						<div className="body-sm text-secondary tabular-nums">
							{`${fmt(hot.loss)} · ${share(hot.loss)}% of deposit`}
						</div>
						{hot.drop >= 100 ? (
							<p className="mt-1.5 border-t border-subtle pt-1.5 body-sm text-secondary">
								{`${catLabel} — a whole-vault failure, not tied to specific collateral.`}
							</p>
						) : hotBreakdown.length ? (
							<div className="mt-1.5 flex flex-col gap-1 border-t border-subtle pt-1.5">
								{hotBreakdown.map((e) => (
									<span key={e.symbol} className="flex items-center gap-1.5 body-sm">
										{e.symbol === 'Other' ? (
											<span className="size-3.5 shrink-0 rounded-full bg-(--text-tertiary)/40" aria-hidden />
										) : (
											<TokenLogo src={e.logoUrl} size={14} alt={e.symbol} />
										)}
										<span className="truncate text-secondary">{e.symbol}</span>
										<span className="ml-auto shrink-0 text-primary tabular-nums">{fmt(e.usd)}</span>
									</span>
								))}
							</div>
						) : null}
						{/* the link opts back into pointer events (the popover is click-through) and jumps
						    to the Scenarios tab via its public anchor — RiskTabs activates it on hashchange */}
						<div className="mt-1.5 border-t border-subtle pt-1.5">
							<a
								href="#vault-risk-scenarios"
								className="pointer-events-auto block w-fit label-sm text-link hover:underline"
							>
								See all scenarios →
							</a>
						</div>
					</div>
				) : null}
			</div>

			{/* drop-severity ticks — the axis, kept to whispers */}
			<div className="relative h-3 body-xs text-tertiary">
				{curvePts.map((p) => (
					<span
						key={p.drop}
						className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums"
						style={{ left: `${p.x}%` }}
					>
						{p.drop >= 100 ? 'extreme' : `−${p.drop}%`}
					</span>
				))}
			</div>

			<p className="body-sm text-tertiary">
				{`Left to right, a deeper collateral crash. Hover any point for the scenarios that drive the loss — only a ${catLabel.toLowerCase()} reaches a total loss.`}
			</p>
		</div>
	)
}
