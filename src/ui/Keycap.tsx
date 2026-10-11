import type { ReactNode } from 'react'

/* ----------------------------------------------------------------------------
   Keycap: one key, or keys pressed together, in a keyboard hint.

   Press <Keycap>⌘</Keycap> <Keycap>↵</Keycap> to run
   <Button variant="primary">Run <Keycap onBrand>⌘</Keycap><Keycap onBrand>↵</Keycap></Button>

   The text is the key as the keyboard prints it (⌘, ⇧↵, Tab, Esc). `onBrand`
   is for a cap inside a brand-filled button, where the page-coloured cap would
   punch a hole in the fill. Keycap takes no className: a cap hidden at a
   breakpoint, or from assistive tech beside a label that already names the
   shortcut, sits in a wrapping span that carries `hidden md:inline` or
   `aria-hidden`. Never a hand-rolled <kbd> (raw-kbd in check-design-tokens.mjs).

   Not a count (CountBadge) and not a value from a set (Tag).
---------------------------------------------------------------------------- */

export function Keycap({ children, onBrand = false }: { children: ReactNode; onBrand?: boolean }) {
	return (
		<kbd
			className={`inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-[3px] border px-0.75 mono-sm tabular-nums ${
				onBrand
					? 'border-(--border-on-brand-seam) text-current'
					: 'border-medium bg-page text-secondary shadow-inset-divider'
			}`}
		>
			{children}
		</kbd>
	)
}
