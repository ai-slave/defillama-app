import clsx from 'clsx'
import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { Icon, type IIcon } from './Icon'
import { tw } from './tw'

/**
 * PromoBadge — the small pill that points at something worth trying: "New", "7-day trial", "Free", "Pro". One look for
 * every promo, in the brand tint: amber is the warning color and green means a value went up, so neither marks a
 * promo. Sentence case; the icon is optional ("sparkles" for New, "file-lock-2" for a locked Pro feature). A paid
 * trial names its length ("7-day trial"), never a bare "free", so it reads apart from a free tier's "Free".
 *
 * Not a value label (that is `Tag`), a state (`StatusBadge`) or a count (`CountBadge`). With `href` the badge is
 * itself the link and takes the hover wash. `className` only shows or hides it (an A/B experiment's hidden/inline-flex
 * pair, `invisible` until the offer is known): `inline-flex` is an `initial:` default, so the caller's display wins.
 *
 * It is 16px tall, the line of a control's label (label-sm), so a badge inside a Button, a tab or a segment never makes
 * that control taller than its siblings.
 */
const PROMO_BADGE_CLASSES = tw`shrink-0 items-center gap-1 rounded-md border border-brand-muted bg-brand-tint px-1.5 py-px label-xs whitespace-nowrap text-link initial:inline-flex`

export function PromoBadge({
	children,
	icon,
	href,
	className
}: {
	children: ReactNode
	icon?: IIcon['name']
	href?: string
	className?: string
}) {
	const content = (
		<>
			{icon ? <Icon name={icon} className="size-3.5" /> : null}
			{children}
		</>
	)
	return href ? (
		<BasicLink href={href} className={clsx(PROMO_BADGE_CLASSES, 'hover-wash', className)}>
			{content}
		</BasicLink>
	) : (
		<span className={clsx(PROMO_BADGE_CLASSES, className)}>{content}</span>
	)
}
