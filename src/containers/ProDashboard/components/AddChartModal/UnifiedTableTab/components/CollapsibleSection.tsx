import { useState } from 'react'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'

interface CollapsibleSectionProps {
	title: string
	badge?: string | number | undefined
	children: React.ReactNode
	className?: string
}

export function CollapsibleSection({ title, badge, children, className = '' }: CollapsibleSectionProps) {
	const [isExpanded, setIsExpanded] = useState(true)

	return (
		<Card padding="none" className={className}>
			<button
				type="button"
				aria-expanded={isExpanded}
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex w-full items-center justify-between rounded-t-lg px-3 py-2.5 transition-colors"
			>
				<div className="flex items-center gap-2">
					{isExpanded ? (
						<Icon name="chevron-down" className="size-4 text-tertiary" />
					) : (
						<Icon name="chevron-right" className="size-4 text-tertiary" />
					)}
					<h3 className="title-md text-primary">{title}</h3>
					{badge !== undefined ? <Tag>{badge}</Tag> : null}
				</div>
			</button>
			{isExpanded ? <div className="border-t border-subtle px-3 py-2.5">{children}</div> : null}
		</Card>
	)
}
