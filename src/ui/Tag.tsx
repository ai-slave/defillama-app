import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithoutRef } from 'react'
import { Icon } from './Icon'

/**
 * Tag — read-only inline label for one value out of a known set (reward types,
 * asset classes, token rights). Flat and variant-free on purpose: it carries no
 * state and no interaction.
 *
 * TagButton is the same label when a click acts on that value (a dashboard
 * card's tag that filters by it): one look in a row of tags, plus a hover wash.
 * TagLink is that label when it opens what the value names (a reference, a
 * source), with a trailing arrow; an icon-only link is a square Button, never a Tag.
 *
 * Not a filter chip and not a selection pill — those are Button `filter`/`toggle`
 * and `MetricChip`, which own their brand active states. A state colored by
 * whether it is good (Live, Failed) is `StatusBadge`. An icon beside the label
 * sits 4px from it, the same gap in all three. `className` is placement only
 * (policy: check-part-classes).
 */
const TAG_CLASSES =
	'inline-flex items-center gap-1 rounded-sm border border-medium bg-surface-elevated-1 px-2 py-0.5 body-sm text-secondary'

export function Tag({ className, ...props }: ComponentPropsWithoutRef<'span'>) {
	return <span className={`${TAG_CLASSES} ${className ?? ''}`.trim()} {...props} />
}

export function TagLink({ className, children, ...props }: ComponentPropsWithoutRef<'a'>) {
	// The trailing arrow says it opens something, where a plain Tag beside it does not; a hover wash alone never shows on
	// touch or to keyboard readers. Up-right opens a new tab, right moves within the site.
	return (
		<a className={`${TAG_CLASSES} hover-wash ${className ?? ''}`.trim()} {...props}>
			{children}
			<Icon
				name={props.target === '_blank' ? 'arrow-up-right' : 'arrow-right'}
				className="size-3 shrink-0"
				aria-hidden
			/>
		</a>
	)
}

export function TagButton({ className, ...props }: ComponentPropsWithoutRef<'button'>) {
	return <Ariakit.Button className={`${TAG_CLASSES} hover-wash cursor-pointer ${className ?? ''}`.trim()} {...props} />
}
