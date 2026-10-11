import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   StatusBadge: a state, colored by whether it is good for the reader.

   <StatusBadge status="good">Live</StatusBadge>
   <StatusBadge status="caution" tooltip="Two of five venues report">Partial</StatusBadge>

   The product decides what is good: it maps its own value to a status
   (fee switch ON is good, equity capture Partial is caution) in a plain
   value → status map, never to classes. The badge owns the look: the status
   tint, a muted border, 6px corners and label-sm, 20px tall, the PromoBadge
   recipe in status colors. A badge that is itself a button or link (a
   hovercard anchor) passes it as `render` and takes the hover wash:
   <Hovercard render={<StatusBadge status="good" render={<button type="button" />} />} …>
   Never color a status pill by hand (hand-built-status-badge in
   check-design-tokens.mjs).

   Not a movement (Change, ./Change.tsx), not a value from a set (Tag), not a
   promo (PromoBadge) and not a grade on a product's own scale.

   StatusDot is the same status as a 6px dot, for a line too quiet for a pill:
   a save state, a connection, a feed's freshness.

   <StatusDot status={dirty ? 'caution' : 'good'} /> {dirty ? 'Unsaved changes' : 'All changes saved'}
   <StatusDot status="good" label="Published" />

   Beside text that names the state, the dot only repeats it in color and is
   hidden from assistive tech. With no such text, `label` names the state.
   `pulse` marks work in progress or a live feed. Never draw a status dot by
   hand (hand-built-status-dot in check-design-tokens.mjs). Not a series or
   category swatch, a kind color, a timeline marker or an unread marker.
---------------------------------------------------------------------------- */

export type Status = 'good' | 'caution' | 'bad' | 'neutral'

const STATUS_CLASSES: Record<Status, string> = {
	good: tw`border-success-muted bg-success-tint text-success`,
	caution: tw`border-warning-muted bg-warning-tint text-warning`,
	bad: tw`border-error-muted bg-error-tint text-error`,
	neutral: tw`border-medium bg-surface-elevated-1 text-secondary`
}

/** `tooltip` explains the state on hover and focus. The badge is the anchor and carries no underline: the pill already
    reads as something to point at, and an underline inside a tinted pill looks like misspelled text. A column whose
    every row would explain the same thing puts one QuestionHelper in its header instead.
    `render` makes the badge a button or link. As an Ariakit host's `render`, the badge takes what the host hands its
    anchor (the label as children, handlers, a ref, layout classes), so `className` is placement only. */
export function StatusBadge({
	status,
	tooltip,
	render,
	className,
	children,
	...props
}: Ariakit.RoleProps<'span'> & {
	status: Status
	tooltip?: ReactNode
}) {
	const classes = clsx(
		`inline-flex shrink-0 items-center rounded-md border px-2 py-px label-sm whitespace-nowrap ${STATUS_CLASSES[status]}`,
		className
	)
	return tooltip ? (
		<Tooltip content={tooltip} render={<span />} tabIndex={0} className={`cursor-help ${classes}`}>
			{children}
		</Tooltip>
	) : (
		<Ariakit.Role.span render={render} className={clsx(classes, render && 'hover-wash')} {...props}>
			{children}
		</Ariakit.Role.span>
	)
}

const DOT_CLASSES: Record<Status, string> = {
	good: tw`bg-success`,
	caution: tw`bg-warning`,
	bad: tw`bg-error`,
	neutral: tw`bg-status-dot`
}

export function StatusDot({ status, label, pulse = false }: { status: Status; label?: string; pulse?: boolean }) {
	return (
		<span
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={`inline-block size-1.5 shrink-0 rounded-full ${DOT_CLASSES[status]} ${pulse ? 'motion-safe:animate-pulse' : ''}`}
		/>
	)
}
