import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   StatusBadge: a state, coloured by whether it is good for the reader.

   <StatusBadge status="good">Live</StatusBadge>
   <StatusBadge status="caution" tooltip="Two of five venues report">Partial</StatusBadge>

   The product decides what is good: it maps its own value to a status
   (fee switch ON is good, equity capture Partial is caution) in a plain
   value → status map, never to classes. The badge owns the look: the status
   tint, a muted border, 6px corners and label-sm, 20px tall, the PromoBadge
   recipe in status colours. A badge that is itself a button or link (a
   hovercard anchor) takes `statusBadgeStyles(status)`, which sets no
   `display`. Never colour a status pill by hand (hand-built-status-badge in
   check-design-tokens.mjs).

   Not a movement (Change, ./Change.tsx), not a value from a set (Tag), not a
   promo (PromoBadge) and not a grade on a product's own scale.
---------------------------------------------------------------------------- */

export type Status = 'good' | 'caution' | 'bad' | 'neutral'

const STATUS_CLASSES: Record<Status, string> = {
	good: tw`border-success-muted bg-success-tint text-success`,
	caution: tw`border-warning-muted bg-warning-tint text-warning`,
	bad: tw`border-error-muted bg-error-tint text-error`,
	neutral: tw`border-medium bg-surface-elevated-1 text-secondary`
}

export function statusBadgeStyles(status: Status) {
	return `shrink-0 items-center rounded-md border px-2 py-px label-sm whitespace-nowrap ${STATUS_CLASSES[status]}`
}

/** `tooltip` explains the state on hover and focus, with a dotted underline that marks the label as explained. */
export function StatusBadge({
	status,
	tooltip,
	children
}: {
	status: Status
	tooltip?: ReactNode
	children: ReactNode
}) {
	return tooltip ? (
		<Tooltip
			content={tooltip}
			render={<span />}
			tabIndex={0}
			className={`inline-flex cursor-help underline decoration-dotted underline-offset-4 ${statusBadgeStyles(status)}`}
		>
			{children}
		</Tooltip>
	) : (
		<span className={`inline-flex ${statusBadgeStyles(status)}`}>{children}</span>
	)
}
