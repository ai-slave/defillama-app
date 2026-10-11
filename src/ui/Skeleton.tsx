import type { CSSProperties } from 'react'

/* ----------------------------------------------------------------------------
   Skeleton — the one loading placeholder shape. bg-skeleton fill (1.35:1 on a card in both modes), pulse
   only when motion is allowed. Callers pass size and radius as layout
   (h-3 w-40, size-10 rounded-lg …); never a color. The 4px radius is an `initial:`
   default, so a caller's rounded-* always wins. `style` is for measured
   widths that mirror the content being loaded. `still` drops the pulse for a
   placeholder that illustrates content rather than waits for it (a table
   behind a "Coming soon" note), where a pulse would read as loading.
---------------------------------------------------------------------------- */
export function Skeleton({ className, style, still }: { className: string; style?: CSSProperties; still?: boolean }) {
	return (
		<span
			aria-hidden
			style={style}
			className={`block bg-skeleton initial:rounded-sm ${still ? '' : 'motion-safe:animate-pulse'} ${className}`}
		/>
	)
}
