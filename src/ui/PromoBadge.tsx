import type { ReactNode } from 'react'
import { Icon, type IIcon } from './Icon'
import { tw } from './tw'

/**
 * PromoBadge — the small pill that points at something worth trying: "New", "7-day trial", "Free", "Pro". One look for
 * every promo, in the brand tint: amber is the warning colour and green means a value went up, so neither marks a
 * promo. Sentence case; the icon is optional ("sparkles" for New, "file-lock-2" for a locked Pro feature). A paid
 * trial names its length ("7-day trial"), never a bare "free", so it reads apart from a free tier's "Free".
 *
 * Not a value label (that is `Tag`) and not a count (`CountBadge`). `promoBadgeStyles` is the same look for a badge
 * that is itself a link or carries A/B display classes; it sets no `display`, so the caller adds `inline-flex` (or
 * its experiment's hidden/inline-flex pair).
 *
 * It is 16px tall, the line of a control's label (label-sm), so a badge inside a Button, a tab or a segment never makes
 * that control taller than its siblings.
 */
export const promoBadgeStyles = tw`shrink-0 items-center gap-1 rounded-md border border-brand-muted bg-brand-tint px-1.5 py-px label-xs whitespace-nowrap text-link`

export function PromoBadge({ children, icon }: { children: ReactNode; icon?: IIcon['name'] }) {
	return (
		<span className={`inline-flex ${promoBadgeStyles}`}>
			{icon ? <Icon name={icon} height={10} width={10} /> : null}
			{children}
		</span>
	)
}
