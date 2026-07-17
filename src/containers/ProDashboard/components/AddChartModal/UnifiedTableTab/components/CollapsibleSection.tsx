import { useState } from 'react'
import { Icon } from '~/components/Icon'

interface CollapsibleSectionProps {
	title: string
	badge?: string | number
	children: React.ReactNode
	className?: string
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, badge, children, className = '' }) => {
	const [isExpanded, setIsExpanded] = useState(true)

	return (
		<div className={`rounded-lg border border-(--pro-cards-border) bg-(--pro-cards-bg) ${className}`}>
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center justify-between rounded-t-lg px-3 py-2.5 transition-colors"
			>
				<div className="flex items-center gap-2">
					{isExpanded ? (
						<Icon name="chevron-down" height={16} width={16} className="text-(--pro-text-tertiary)" />
					) : (
						<Icon name="chevron-right" height={16} width={16} className="text-(--pro-text-tertiary)" />
					)}
					<h3 className="text-sm font-semibold text-(--pro-text-primary)">{title}</h3>
					{badge !== undefined ? (
						<span className="rounded-sm bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">{badge}</span>
					) : null}
				</div>
			</button>
			{isExpanded ? <div className="border-t border-(--pro-cards-border) px-3 py-2.5">{children}</div> : null}
		</div>
	)
}
