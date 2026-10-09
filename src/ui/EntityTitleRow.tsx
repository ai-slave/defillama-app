import type { ElementType, ReactNode } from 'react'

/* ----------------------------------------------------------------------------
   EntityTitleRow — the name row at the top of an entity page's stats card
   (chain, protocol, exchange, stablecoin, token, pre-IPO company).

   The 24px logo, then the heading in heading-sm with what belongs to the
   name (the symbol in font-normal, a kind Tag, a deprecated marker), then
   the page actions (website, bookmark, price alert) pushed right. The
   heading holds the name only, so it reads as the name; the logo and the
   actions sit beside it. min-h-8 is the height of the md actions, so the row
   is as tall with or without them and neighbouring cards' first rows line
   up (design.md → "Aligning neighbouring cards").
---------------------------------------------------------------------------- */
export function EntityTitleRow({
	as: Heading = 'h1',
	logo,
	children,
	actions
}: {
	/** h1 on the entity's own page; h2 where the page already has one. */
	as?: ElementType
	logo: ReactNode
	children: ReactNode
	actions?: ReactNode
}) {
	return (
		<div className="flex min-h-8 flex-wrap items-center gap-2">
			{logo}
			<Heading className="flex min-w-0 flex-wrap items-center gap-2 heading-sm">{children}</Heading>
			{actions ? <span className="ml-auto flex items-center justify-end gap-1">{actions}</span> : null}
		</div>
	)
}
