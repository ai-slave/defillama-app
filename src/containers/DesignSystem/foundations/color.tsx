import { useSyncExternalStore } from 'react'
import {
	CHART_COLORS,
	CHART_DOWN,
	CHART_UP,
	divergingColor,
	HEAT_DOWN,
	HEAT_UP,
	OTHERS_COLOR
} from '~/constants/colors'
import { Change } from '~/ui/Change'
import { Example, type Foundation } from '../shared'

/* Color, the ramps and the chart palette. Color token names are read from the loaded stylesheet (the light blocks
   of primitives.css and semantics.css), so a token added there shows here without an edit; each swatch reads its
   own resolved value, so a dark pane shows dark values. */

type TokenNames = { semantic: Array<string>; ramps: Array<[string, Array<string>]> }

const NO_TOKENS: TokenNames = { semantic: [], ramps: [] }
let tokenNames: TokenNames | null = null

function readTokenNames(): TokenNames {
	if (tokenNames) return tokenNames
	const semantic = new Set<string>()
	const ramps = new Map<string, Array<string>>()
	const visit = (rules: CSSRuleList) => {
		for (const rule of rules) {
			if (rule instanceof CSSStyleRule) {
				// The light blocks only: the dark blocks redeclare the same names.
				if (!rule.selectorText.includes(':root') || rule.selectorText.includes('html.dark')) continue
				for (const name of rule.style) {
					// Steps 1–12 only: --neutral-500 is the fixed scrollbar color, not a ramp step.
					const step = /^--([a-z]+)-([1-9]|1[0-2])$/.exec(name)
					if (step) {
						const hue = ramps.get(step[1]) ?? []
						if (!hue.includes(name)) hue.push(name)
						ramps.set(step[1], hue)
					} else if (/^--(bg|text|border|chart)-/.test(name)) semantic.add(name)
				}
			} else if (rule instanceof CSSGroupingRule) visit(rule.cssRules)
		}
	}
	for (const sheet of document.styleSheets) visit(sheet.cssRules)
	tokenNames = {
		semantic: [...semantic],
		ramps: [...ramps]
	}
	return tokenNames
}

const noSubscription = () => () => {}

/** The token names, read once on the client; the server render has none, since it has no stylesheet to read. */
function useTokenNames() {
	return useSyncExternalStore(noSubscription, readTokenNames, () => NO_TOKENS)
}

/** The token's resolved value where it renders, so the dark pane reads the dark value. */
function TokenValue({ name }: { name: string }) {
	return (
		<span
			ref={(node) => {
				if (node) node.textContent = getComputedStyle(node).getPropertyValue(name).trim()
			}}
			className="truncate mono-sm text-tertiary"
		/>
	)
}

function SwatchGrid({ children }: { children: React.ReactNode }) {
	return <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-5">{children}</div>
}

function Swatch({ name, kind }: { name: string; kind: 'fill' | 'text' | 'border' }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			{kind === 'text' ? (
				<span
					className="flex h-12 items-center rounded-lg border border-subtle bg-surface px-3 label-lg"
					style={{ color: `var(${name})` }}
				>
					Aa 12.4%
				</span>
			) : kind === 'border' ? (
				<span className="h-12 rounded-lg bg-surface" style={{ border: `2px solid var(${name})` }} />
			) : (
				<span className="h-12 rounded-lg border border-subtle" style={{ background: `var(${name})` }} />
			)}
			<span className="truncate mono-sm text-primary">{name}</span>
			<TokenValue name={name} />
		</div>
	)
}

function ColorOverview() {
	const { semantic } = useTokenNames()
	const families = [
		['--bg-', 'Backgrounds', 'fill', 'Page, surfaces, overlays, fills and the tints a banner or badge sits on.'],
		['--text-', 'Text', 'text', 'Text tiers and the data, status and link colors, shown on a surface.'],
		['--border-', 'Borders', 'border', 'Dividers, control outlines and status edges at 2px so the hue reads.'],
		[
			'--chart-',
			'Chart tokens',
			'fill',
			'The canvas colors charts resolve from CSS: up and down marks, grid and labels.'
		]
	] as const
	return (
		<>
			{families.map(([prefix, title, kind, note]) => (
				<Example key={prefix} wide name={title} prop={`${prefix}*`} note={note}>
					<SwatchGrid>
						{semantic
							.filter((name) => name.startsWith(prefix))
							.map((name) => (
								<Swatch key={name} name={name} kind={kind} />
							))}
					</SwatchGrid>
				</Example>
			))}
			<Example name="Text tiers" note="Text and data colors on a surface. Data colors only reach text through Change.">
				<div className="grid grid-cols-2 gap-x-6 gap-y-1">
					<span className="body-sm text-primary">text-primary</span>
					<span className="body-sm text-link">text-link</span>
					<span className="body-sm text-secondary">text-secondary</span>
					<span className="body-sm text-secondary">
						data-up <Change value={2.41} />
					</span>
					<span className="body-sm text-tertiary">text-tertiary</span>
					<span className="body-sm text-secondary">
						data-down <Change value={-3.12} />
					</span>
					<span className="body-sm text-disabled">text-disabled</span>
					<span className="body-sm text-warning">text-warning</span>
					<span />
					<span className="body-sm text-error">text-error</span>
				</div>
			</Example>
		</>
	)
}

function RampsOverview() {
	const { ramps } = useTokenNames()
	return (
		<Example
			wide
			name="Primitives"
			prop="--<hue>-1 … 12"
			note="Generated by scripts/generate-color-ramps.mjs. Each step has one role and the same contrast in every hue; components use the semantic tokens, never these."
		>
			<div className="flex min-w-[720px] flex-col gap-2">
				<div className="grid grid-cols-[6rem_repeat(12,minmax(0,1fr))] gap-1">
					<span />
					{Array.from({ length: 12 }, (_, step) => (
						<span key={step} className="text-center label-xs text-tertiary">
							{step + 1}
						</span>
					))}
				</div>
				{ramps.map(([hue, steps]) => (
					<div key={hue} className="grid grid-cols-[6rem_repeat(12,minmax(0,1fr))] items-center gap-1">
						<span className="label-sm text-secondary">{hue}</span>
						{steps.map((name) => (
							<span key={name} className="h-9 rounded-sm" style={{ background: `var(${name})` }} />
						))}
					</div>
				))}
			</div>
		</Example>
	)
}

function FixedSwatch({ color, label, value }: { color: string; label: string; value: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<span className="h-12 rounded-lg border border-subtle" style={{ background: color }} />
			<span className="truncate mono-sm text-primary">{label}</span>
			<span className="truncate mono-sm text-tertiary">{value}</span>
		</div>
	)
}

const SCALE_STEPS = Array.from({ length: 21 }, (_, i) => (i - 10) / 10)

function ChartPaletteOverview() {
	return (
		<>
			<Example
				wide
				name="CHART_COLORS"
				note="The one series palette, in order; past the limit a series is Others, or, in a stack that shows every series, takes the color it overlaps least with. Every color passes 3:1 on the chart backgrounds in both modes."
			>
				<SwatchGrid>
					{CHART_COLORS.map((color, index) => (
						<FixedSwatch key={color} color={color} label={`chartColor(${index})`} value={color} />
					))}
					<FixedSwatch color={OTHERS_COLOR} label="OTHERS_COLOR" value={OTHERS_COLOR} />
				</SwatchGrid>
			</Example>
			<Example name="Up and down" note="Marks resolve the mode's tokens; heat cells behind text keep fixed values.">
				<SwatchGrid>
					<FixedSwatch color={CHART_UP} label="CHART_UP" value="var(--chart-up)" />
					<FixedSwatch color={CHART_DOWN} label="CHART_DOWN" value="var(--chart-down)" />
					<FixedSwatch color={HEAT_UP} label="HEAT_UP" value={HEAT_UP} />
					<FixedSwatch color={HEAT_DOWN} label="HEAT_DOWN" value={HEAT_DOWN} />
				</SwatchGrid>
			</Example>
			<Example
				name="divergingColor(t)"
				note="The value scale for heatmaps and treemaps: down through Others gray to up, mixed in OKLab."
			>
				<div className="flex flex-col gap-1.5">
					<div className="flex h-10 overflow-hidden rounded-lg">
						{SCALE_STEPS.map((t) => (
							<span key={t} className="flex-1" style={{ background: divergingColor(t) }} />
						))}
					</div>
					<div className="flex justify-between mono-sm text-tertiary">
						<span>−1</span>
						<span>0</span>
						<span>+1</span>
					</div>
				</div>
			</Example>
		</>
	)
}

export const color: Foundation = {
	id: 'color',
	name: 'Color',
	source: 'src/styles/semantics.css',
	overview: ColorOverview
}

export const colorRamps: Foundation = {
	id: 'color-ramps',
	name: 'Color ramps',
	source: 'src/styles/primitives.css',
	overview: RampsOverview
}

export const chartPalette: Foundation = {
	id: 'chart-palette',
	name: 'Chart palette',
	source: 'src/constants/colors.ts',
	overview: ChartPaletteOverview
}
