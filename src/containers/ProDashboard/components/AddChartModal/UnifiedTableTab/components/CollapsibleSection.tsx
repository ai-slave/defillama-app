import { useState } from 'react'
import { Card } from '~/ui/Card'
import { DisclosureChevron } from '~/ui/DisclosureChevron'
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
					<DisclosureChevron kind="section" size="sm" open={isExpanded} />
					<h3 className="title-md text-primary">{title}</h3>
					{badge !== undefined ? <Tag>{badge}</Tag> : null}
				</div>
			</button>
			{isExpanded ? <div className="border-t border-subtle px-3 py-2.5">{children}</div> : null}
		</Card>
	)
}
