import type { ReactNode } from 'react'
import { tw } from '~/ui/tw'

export type ProBadgeTone = 'neutral' | 'success' | 'premium' | 'info' | 'warning'

const PRO_BADGE_BASE = tw`inline-flex items-center gap-1 rounded-md px-2 py-0.5 label-sm`

const PRO_BADGE_TONES: Record<ProBadgeTone, string> = {
	neutral: tw`bg-surface-elevated-1 text-pro-text-label`,
	success: tw`border border-pro-success-400/20 bg-pro-success-100 text-pro-success-400 dark:bg-pro-success-300/12 dark:text-pro-success-200`,
	premium: tw`border border-pro-premium-400/20 bg-pro-premium-100 text-pro-premium-400 dark:bg-pro-premium-300/12 dark:text-pro-premium-200`,
	info: tw`border border-pro-info-400/20 bg-pro-info-100 text-pro-info-400 dark:bg-pro-info-300/12 dark:text-pro-info-200`,
	warning: tw`bg-pro-premium-100 text-pro-premium-400`
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
