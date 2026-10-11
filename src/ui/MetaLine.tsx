import { Children, type ReactNode } from 'react'

/* ----------------------------------------------------------------------------
   MetaLine: short facts about one thing, separated by middots, under or
   beside its name: "9 cards · 52 views · Updated 4d ago", a card's source
   and grouping, an article's date and reading time.

   <MetaLine>
     {`${count} cards`}
     {author ? `by ${author}` : null}
     <RelativeTime … />
   </MetaLine>

   Each child is one item, so callers never invent keys. body-sm
   text-tertiary, 6px between an item and a dot; the line wraps between
   items. An empty item (null, undefined, false, '') drops out with its dot,
   so callers write conditions inline; with no items left nothing renders.
   Adjacent literal text is one JSX text node, so a line of literals goes
   in as one array of strings: <MetaLine>{['Daily', '3 tokens']}</MetaLine>.
   The dots are aria-hidden: assistive tech reads the items alone. An item
   that needs weight (a status, a link) brings its own element and color;
   the line owns the size and the tier.

   Not a sentence: prose that happens to contain "·" stays text. Not a
   keyboard hint row (Keycap pairs), and not a label over a value (a detail
   field). `className` is placement only (shrink-0, min-w-0, mt-auto,
   tabular-nums for counts that change).
---------------------------------------------------------------------------- */

export function MetaLine({ children, className }: { children: ReactNode; className?: string }) {
	// toArray already drops null, undefined and booleans and flattens arrays.
	const visible = Children.toArray(children).filter((item) => item !== '')
	if (visible.length === 0) return null
	// Nested fragments keep each item in its own slot without keys.
	let separated: ReactNode = visible[0]
	for (let index = 1; index < visible.length; index++) {
		separated = (
			<>
				{separated}
				<span aria-hidden="true">·</span>
				{visible[index]}
			</>
		)
	}
	return (
		<span className={`flex flex-wrap items-center gap-x-1.5 body-sm text-tertiary ${className ?? ''}`.trim()}>
			{separated}
		</span>
	)
}
