import type { CSSProperties } from 'react'

/* ----------------------------------------------------------------------------
   Skeleton — the one loading placeholder shape. Neutral elevated fill, pulse
   only when motion is allowed. Callers pass size and radius as layout
   (h-3 w-40, size-10 rounded-lg …); never a color. `style` is for measured
   widths that mirror the content being loaded. `still` drops the pulse for a
   placeholder that illustrates content rather than waits for it (a table
   behind a "Coming Soon" note), where a pulse would read as loading.
---------------------------------------------------------------------------- */
export function Skeleton({ className, style, still }: { className: string; style?: CSSProperties; still?: boolean }) {
	return (
		<span
			aria-hidden
			style={style}
			// The 4px default applies only when the caller passes no radius: a base `rounded-sm` would win over the
			// caller's `rounded-lg` or `rounded-full`, which Tailwind emits earlier in the stylesheet.
			className={`block bg-surface-elevated-2 ${still ? '' : 'motion-safe:animate-pulse'} ${/(?:^|\s)rounded-/.test(className) ? '' : 'rounded-sm'} ${className}`}
		/>
	)
}
