import type { CSSProperties } from 'react'

/* ----------------------------------------------------------------------------
   Skeleton — the one loading placeholder shape. Neutral elevated fill, pulse
   only when motion is allowed. Callers pass size and radius as layout
   (h-3 w-40, size-10 rounded-lg …); never a color. `style` is for measured
   widths that mirror the content being loaded.
---------------------------------------------------------------------------- */
export function Skeleton({ className, style }: { className: string; style?: CSSProperties }) {
	return (
		<span
			aria-hidden
			style={style}
			className={`block rounded-sm bg-surface-elevated-2 motion-safe:animate-pulse ${className}`}
		/>
	)
}
