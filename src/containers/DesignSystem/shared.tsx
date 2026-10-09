import { createContext, type ReactNode, useContext } from 'react'

/* The design system page's layout parts: an Example names one demo and renders it in light, dark or both; a Group
   holds the examples for one job; a StateGrid lays out one row per variant and one column per state. */

export type ForcedState = 'hover' | 'focus-visible' | 'focus' | 'active'

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
	return (
		// The padding sits inside the scroller: a demo that moves past its box (the bouncing loading dots, a focus ring)
		// then stays inside it, instead of flashing a scrollbar on every frame.
		<div
			className={`flex min-w-0 flex-col gap-3 overflow-x-auto rounded-lg border border-subtle bg-surface p-5 text-primary ${dark ? 'theme-dark' : ''}`}
		>
			{labelled ? (
				<span className="label-xs tracking-wide text-tertiary uppercase">{dark ? 'Dark' : 'Light'}</span>
			) : null}
			{children}
		</div>
	)
}

/** One named demo: the component, the prop it shows, when to use it, then the demo in one or both themes. */
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
	const split = useContext(SplitContext)
	return (
		<article className={`flex min-w-0 flex-col gap-3 ${wide ? 'xl:col-span-2' : ''}`}>
			<header className="flex flex-col gap-1">
				<h3 className="flex flex-wrap items-baseline gap-x-2 label-md text-primary">
					{name}
					{prop ? <code className="mono-sm text-secondary">{prop}</code> : null}
				</h3>
				{note ? <p className="max-w-[90ch] body-sm text-secondary">{note}</p> : null}
			</header>
			{split ? (
				<div className={`grid grid-cols-1 gap-3 ${wide ? '2xl:grid-cols-2' : ''}`}>
					<Pane dark={false} labelled>
						{children}
					</Pane>
					<Pane dark labelled>
						{children}
					</Pane>
				</div>
			) : (
				<Pane dark={false} labelled={false}>
					{children}
				</Pane>
			)}
		</article>
	)
}

export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	return (
		<section id={id} className="flex scroll-mt-20 flex-col gap-6">
			<h2 className="border-b border-subtle pb-3 heading-sm text-primary">{title}</h2>
			<div className="grid grid-cols-1 gap-x-6 gap-y-10 xl:grid-cols-2">{children}</div>
		</section>
	)
}

/** One row per variant and one column per state. Cells keep their own size (justify-items-start): a grid's default
    stretch would widen a square button to its column, and aspect-square would then grow it. */
export function StateGrid({
	columns,
	rows
}: {
	columns: ReadonlyArray<string>
	rows: ReadonlyArray<[string, ReactNode]>
}) {
	return (
		<div
			className="grid w-max items-center justify-items-start gap-x-6 gap-y-3"
			style={{ gridTemplateColumns: `9rem repeat(${columns.length}, auto)` }}
		>
			<span />
			{columns.map((column) => (
				<span key={column} className="label-xs tracking-wide text-tertiary uppercase">
					{column}
				</span>
			))}
			{rows.map(([label, cells]) => (
				<div key={label} className="contents">
					<span className="label-sm text-secondary">{label}</span>
					{cells}
				</div>
			))}
		</div>
	)
}

export function NotApplicable() {
	return <span className="body-sm text-disabled">—</span>
}

export function Row({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
