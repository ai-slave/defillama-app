import { Button } from './Button'
import { Icon } from './Icon'

/* ----------------------------------------------------------------------------
   DisclosureChevron — the chevron on anything that shows or hides content in
   place: a `<details>` section, a FAQ, a "show more" button, a tree or table
   row. A trigger that opens a list or a panel beside it (a picker, a menu, a
   popover) ends with DisclosureArrow instead (./ComboboxSelectTrigger.tsx),
   which never turns.

   `kind` picks the convention by job, one for each, app-wide:
   - section: points down and turns to point up when open. Sections, FAQs,
     a headline value's breakdown, show more and show less.
   - tree: points right and turns to point down when open. Tree rows,
     sidebar groups, table rows that expand into child rows.
   A row that opens a detail panel (sub-scores, a breakdown) is a section,
   even in a table: a right chevron at a row's end reads as "go to".

   Inside a `<summary>` it follows its `<details>` on its own. On a button
   (or a row) the caller passes `open`, which also goes on the button as
   `aria-expanded`; the chevron never reads an ancestor's `aria-expanded`,
   because a closed row nested in an open one would turn with it.

   `size`: sm (14px) beside a label, as every icon beside a label is; md
   (16px) alone in an icon-only button, and beside a headline value whose
   figure dwarfs a 14px glyph (HeroMetric, the Key Metrics rows). The
   chevron is always the tertiary affordance color. `className` is
   placement only (a baseline nudge such as `relative top-1`, `ml-auto`).

   RowExpandButton is the expander of a row with child rows: a ghost square
   button with the tree chevron, named by the caller's `label` (aria-label).
   A row's detail-panel toggle is a ghost square Button with a section
   chevron.
---------------------------------------------------------------------------- */

const SIZES = { sm: 'size-3.5', md: 'size-4' } as const

const TURNS = {
	section: { icon: 'chevron-down', open: 'rotate-180', summary: 'in-[details[open]>summary]:rotate-180' },
	tree: { icon: 'chevron-right', open: 'rotate-90', summary: 'in-[details[open]>summary]:rotate-90' }
} as const

export function DisclosureChevron({
	kind,
	size,
	open,
	className
}: {
	kind: keyof typeof TURNS
	size: keyof typeof SIZES
	/** Omit inside a `<summary>`, which turns it from its `<details>`. */
	open?: boolean
	/** Placement only. */
	className?: string
}) {
	const turn = TURNS[kind]
	const state = open === undefined ? turn.summary : open ? turn.open : ''
	return (
		<Icon
			name={turn.icon}
			aria-hidden
			className={`${SIZES[size]} shrink-0 text-tertiary transition-transform duration-100 motion-reduce:transition-none ${state} ${className ?? ''}`}
		/>
	)
}

/** A table row's expand toggle. `label` names it for screen readers; `aria-expanded` says whether it is open. */
export function RowExpandButton({
	expanded,
	onClick,
	label,
	className
}: {
	expanded: boolean
	onClick: () => void
	label: string
	/** Placement only. */
	className?: string
}) {
	return (
		<Button
			size="sm"
			variant="ghost"
			square
			type="button"
			aria-expanded={expanded}
			aria-label={label}
			onClick={onClick}
			className={className}
		>
			<DisclosureChevron kind="tree" size="md" open={expanded} />
		</Button>
	)
}
