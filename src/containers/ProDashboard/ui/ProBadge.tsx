import type { ReactNode } from 'react'
import { tw } from '~/ui/tw'

export type ProBadgeTone = 'neutral' | 'success' | 'premium' | 'info' | 'warning' | 'up' | 'down'

const PRO_BADGE_BASE = tw`inline-flex items-center gap-1 rounded-md px-2 py-0.5 label-sm`

const PRO_BADGE_TONES: Record<ProBadgeTone, string> = {
	neutral: tw`bg-surface-elevated-1 text-secondary`,
	success: tw`border border-success-muted bg-success-tint text-success`,
	premium: tw`border border-warning-muted bg-warning-tint text-warning`,
	info: tw`border border-brand-muted bg-brand-tint text-link`,
	warning: tw`bg-warning-tint text-warning`,
	// Movement: a change in value is data-up/down, never success or warning (design.md → Tokens).
	up: tw`border border-data-up-muted bg-data-up-tint text-data-up`,
	down: tw`border border-data-down-muted bg-data-down-tint text-data-down`
}

export function ProBadge({
	tone = 'neutral',
	icon,
	children,
	className
}: {
	tone?: ProBadgeTone
	icon?: ReactNode
	children: ReactNode
	className?: string | undefined
}) {
	return (
		<span className={`${PRO_BADGE_BASE} ${PRO_BADGE_TONES[tone]} ${className ?? ''}`.trim()}>
			{icon}
			{children}
		</span>
	)
}
