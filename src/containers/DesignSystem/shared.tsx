import { Children, createContext, Fragment, isValidElement, type ReactNode, useContext, useState } from 'react'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { AnatomyContext, AnatomyLayer } from './anatomy'

/* The design system page's registry and layout parts. A Foundation is one token page. A Family is one page of parts
   that share a job (buttons, pickers, dialogs); each PartSpec draws its part once, live, from the values its knobs
   pick, and keeps its full state matrices and its look rules beside it. An Example names one demo and renders it in
   light, dark or both; a StateGrid lays out one row per variant and one column per state; a DoDont shows a look rule
   both ways. */

export type Foundation = {
	/** Its path under /dev/design-system (`color-ramps`). */
	id: string
	/** The rail label and header. */
	name: string
	/** The file that holds the rules: a token stylesheet, or design.md. The coverage test fails on a path that does
	    not exist. */
	source: string
	overview: () => ReactNode
}

/** One playground control: a pick from `values`, which starts on the first, or an on/off switch, which starts off.
    Its `name` is the prop it sets, and the playground's code line shows it (`variant="filter"`, a bare `square` when
    on), leaving out the value equal to `default`, the prop's own default; a required prop has none, so it always
    shows. An optional boolean that is off is left out; a `required` one shows as `when={false}`.

    A knob sets only what the part's own interaction cannot reach: a variant, a size, a moment like loading, error or
    disabled. A value the part's interaction changes (checked, selected, typed text, a pick) is demo state, never a
    knob, so a knob never fights a click.

    `prop: false` marks a knob the code line shows as a JSX comment (state: loading), except at its `default`: a
    `state` that sets several props or a forced state, an icon child, or a real prop whose value the demo supplies
    (StatusBadge `tooltip`: the knob only turns it on). */
export type Knob =
	| { name: string; values: ReadonlyArray<string>; default?: string; prop?: false }
	| { name: string; boolean: true; required?: true; prop?: false }

export type KnobValues = Record<string, string | boolean>

export type PartSpec = {
	/** The component's name. The design.md rows whose Use cell names it head its family page, and the coverage test
	    fails on a part no row names unless the test lists it with a reason. On its family page it is the anchor `#<kebab name>`. */
	name: string
	/** The file that holds the part's rules (its header comment). The coverage test fails on a path that does not
	    exist. */
	source: string
	/** Only what changes the part's look or behavior and a reader picks between. */
	knobs?: ReadonlyArray<Knob>
	/** The live part for the knobs' current values, in a slot sized like the one the app gives it. A part that holds
	    state returns a named component. */
	render: (values: KnobValues) => ReactNode
	/** How to drive the playground, in one sentence, when it is not obvious ("Open one: …"). */
	note?: string
	/** The full state matrices and the demos of options no knob covers, as Examples; collapsed under the playground. */
	states?: () => ReactNode
	/** The part's DoDont pairs, as Examples; shown openly under the playground. */
	dos?: () => ReactNode
	/** `render` marks regions with data-anatomy, so the playground offers Show anatomy (./anatomy.tsx). */
	anatomy?: boolean
}

export type Family = { id: string; title: string; parts: ReadonlyArray<PartSpec> }

/** A name in kebab case, for a part's anchor (`SegmentedControl` → `segmented-control`). */
export const slug = (name: string) =>
	name
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')

export type ForcedState = 'hover' | 'focus-visible' | 'focus' | 'active'

/** The forced columns of an interaction matrix (Rest, Hover, Focus); add `'active'` for Pressed. */
export const REST_HOVER_FOCUS = [undefined, 'hover', 'focus-visible'] as const

/** A read failure hands its query to a status part as `retry`; this stands in for a failed query. */
export const FAILED_READ = { refetch() {}, isFetching: false }

/** One cell of a state grid; `force` renders the child as hovered, focused or pressed. */
export function Cell({ force, children }: { force?: ForcedState; children: ReactNode }) {
	return (
		<div data-force={force} className="contents">
			{children}
		</div>
	)
}

/* Side by side shows each example twice: the page in light, and the same markup in an always-dark scope. */
export const SplitContext = createContext(false)

function Pane({ dark, labelled, children }: { dark: boolean; labelled: boolean; children: ReactNode }) {
	const anatomy = useContext(AnatomyContext)
	return (
		// The padding sits inside the scroller: a demo that moves past its box (the bouncing loading dots, a focus ring)
		// then stays inside it, instead of flashing a scrollbar on every frame. Demos render real links and forms, and
		// following one would leave the page, so the frame cancels link clicks (Enter on a link fires one too) and
		// submits. React events pass through portals, so a menu or popover a demo opens is covered as well.
		<div
			onClickCapture={(event) => {
				if ((event.target as Element).closest('a[href]')) event.preventDefault()
			}}
			onSubmitCapture={(event) => event.preventDefault()}
			className={`relative flex min-w-0 flex-col gap-3 overflow-x-auto rounded-lg border border-subtle bg-surface p-5 text-primary ${dark ? 'theme-dark' : ''}`}
		>
			{labelled ? (
				<span className="label-xs tracking-wide text-tertiary uppercase">{dark ? 'Dark' : 'Light'}</span>
			) : null}
			{children}
			{anatomy ? <AnatomyLayer /> : null}
		</div>
	)
}

/** The level of an Example's name: h3 under a foundation's h2, h4 under a part's h3 on a family page. */
export const ExampleLevel = createContext<'h3' | 'h4'>('h4')

/** A demo in the page's theme view: one pane, or light and dark panes (side by side at 2xl when `wide`). */
export function Frame({ wide, children }: { wide: boolean; children: ReactNode }) {
	const split = useContext(SplitContext)
	if (!split)
		return (
			<Pane dark={false} labelled={false}>
				{children}
			</Pane>
		)
	return (
		<div className={`grid grid-cols-1 gap-3 ${wide ? '2xl:grid-cols-2' : ''}`}>
			<Pane dark={false} labelled>
				{children}
			</Pane>
			<Pane dark labelled>
				{children}
			</Pane>
		</div>
	)
}

/** One named demo: what it shows, the prop it shows, then the demo in one or both themes. The rules stay in the
    part's `source` and design.md rows, never restated here; `note` only says what the demo shows or how to drive it. */
export function Example({
	name,
	prop,
	note,
	wide = false,
	children
}: {
	name: string
	prop?: string
	note?: ReactNode
	/** State grids and anything wider than half the page. */
	wide?: boolean
	children: ReactNode
}) {
	const level = useContext(ExampleLevel)
	const title = (
		<>
			{name}
			{prop ? <code className="mono-sm text-secondary">{prop}</code> : null}
		</>
	)
	const titleClass = 'flex flex-wrap items-baseline gap-x-2 label-md text-primary'
	return (
		<article className={`flex min-w-0 flex-col gap-3 ${wide ? 'xl:col-span-2' : ''}`}>
			<header className="flex flex-col gap-1">
				{level === 'h3' ? <h3 className={titleClass}>{title}</h3> : <h4 className={titleClass}>{title}</h4>}
				{note ? <p className="max-w-[90ch] body-sm text-secondary">{note}</p> : null}
			</header>
			<Frame wide={wide}>{children}</Frame>
		</article>
	)
}

/** The fewest stacked blocks of columns whose widest block fits the frame. Each block is a w-max grid, so its tracks
    are the columns' max-content widths and do not change with the split; the result is stable once applied. */
function blocksToFit(wrapper: HTMLElement, count: number) {
	const widths: Array<number> = []
	let label = 0
	let gap = 0
	for (const grid of wrapper.children) {
		const style = getComputedStyle(grid)
		const tracks = style.gridTemplateColumns.split(' ').map(parseFloat)
		label = tracks[0]
		gap = parseFloat(style.columnGap)
		for (let index = 1; index < tracks.length; index++) widths.push(tracks[index])
	}
	for (let blocks = 1; blocks < count; blocks++) {
		const size = Math.ceil(count / blocks)
		let widest = 0
		for (let start = 0; start < count; start += size) {
			let width = label
			for (let index = start; index < Math.min(start + size, count); index++) width += gap + widths[index]
			widest = Math.max(widest, width)
		}
		if (widest <= wrapper.clientWidth) return blocks
	}
	return count
}

/** One row per variant and one column per state, never scrolled sideways: when the columns do not fit the frame,
    they wrap into stacked blocks, each repeating the row labels and its column headers. A row's cells are the
    children of one fragment, one per column (a one-column row may pass its cell alone). Cells keep their own size
    (justify-items-start): a grid's default stretch would widen a square button to its column, and aspect-square
    would then grow it. */
export function StateGrid({
	columns,
	rows
}: {
	columns: ReadonlyArray<string>
	rows: ReadonlyArray<[string, ReactNode]>
}) {
	const [blocks, setBlocks] = useState(1)
	const size = Math.ceil(columns.length / blocks)
	const starts: Array<number> = []
	for (let start = 0; start < columns.length; start += size) starts.push(start)
	const cells = rows.map(([, row]) =>
		Children.toArray(isValidElement<{ children: ReactNode }>(row) && row.type === Fragment ? row.props.children : row)
	)
	return (
		<div
			ref={(wrapper) => {
				const observer = new ResizeObserver(() => setBlocks(blocksToFit(wrapper, columns.length)))
				observer.observe(wrapper)
				return () => observer.disconnect()
			}}
			className="flex min-w-0 flex-col items-start gap-8"
		>
			{starts.map((start) => (
				<div
					key={start}
					className="grid w-max items-center justify-items-start gap-x-6 gap-y-3"
					style={{ gridTemplateColumns: `9rem repeat(${Math.min(size, columns.length - start)}, auto)` }}
				>
					<span />
					{columns.slice(start, start + size).map((column) => (
						<span key={column} className="label-xs tracking-wide text-tertiary uppercase">
							{column}
						</span>
					))}
					{rows.map(([label], index) => (
						<div key={label} className="contents">
							<span className="label-sm text-secondary">{label}</span>
							{cells[index].slice(start, start + size)}
						</div>
					))}
				</div>
			))}
		</div>
	)
}

/** A look rule shown both ways, each drawn by the real parts: what the rule asks for, then what it prevents. Each
    caption says what the reader sees in its cell; the rule itself stays in the part's `source`. */
export function DoDont({
	good,
	goodCaption,
	bad,
	badCaption
}: {
	good: ReactNode
	goodCaption: string
	bad: ReactNode
	badCaption: string
}) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<Card padding="base" className="flex flex-col gap-3">
				<span className="flex items-center gap-1 label-sm text-success">
					<Icon name="check" className="size-3.5" aria-hidden />
					Do
				</span>
				{good}
				<p className="body-sm text-secondary">{goodCaption}</p>
			</Card>
			<Card padding="base" className="flex flex-col gap-3">
				<span className="flex items-center gap-1 label-sm text-error">
					<Icon name="x" className="size-3.5" aria-hidden />
					Don&rsquo;t
				</span>
				{bad}
				<p className="body-sm text-secondary">{badCaption}</p>
			</Card>
		</div>
	)
}

export function NotApplicable() {
	return <span className="body-sm text-disabled">—</span>
}

export function Row({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
