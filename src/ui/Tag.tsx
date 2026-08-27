import type { ComponentPropsWithoutRef } from 'react'

/**
 * Tag — read-only inline label for one value out of a known set (reward types,
 * asset classes, token rights). Flat and variant-free on purpose: it carries no
 * state and no interaction.
 *
 * Not a filter chip and not a selection pill — those are Button `filter`/`toggle`
 * and `MetricChip`, which own their brand active states. `className` is for
 * layout placement only, never colors, radius, or type styles.
 */
export function Tag({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
	return (
		<span
			className={`inline-flex items-center rounded-sm border border-medium bg-surface-elevated-1 px-2 py-0.5 body-sm text-secondary ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
