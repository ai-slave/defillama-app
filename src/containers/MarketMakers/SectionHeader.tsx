import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { AccentBadge } from './badges'
import { ArrowRightIcon } from './icons'
import { forgdPrimaryLinkStyles } from './styles'

export function RfqButton() {
	return (
		<a
			href="https://www.forgd.com/engage-a-market-maker/request-for-quotations"
			target="_blank"
			rel="noreferrer noopener"
			className={forgdPrimaryLinkStyles}
		>
			<span className="hidden min-[713px]:inline">Conduct a Market Maker RFQ</span>
			<span className="min-[713px]:hidden">Conduct an RFQ</span>
			<ArrowRightIcon />
		</a>
	)
}

export function DocsActionButton({ onClick }: { onClick: () => void }) {
	return (
		<Button type="button" onClick={onClick} size="md">
			Documentation
			<ArrowRightIcon />
		</Button>
	)
}

export function AboutButton({ onClick }: { onClick: () => void }) {
	return (
		<Button type="button" onClick={onClick} size="md">
			<span className="hidden min-[713px]:inline">About this Leaderboard</span>
			<span className="min-[713px]:hidden">About</span>
			<ArrowRightIcon />
		</Button>
	)
}

export function SectionHeader({
	title,
	description,
	badge,
	action
}: {
	title: string
	description: string
	badge: string
	action?: ReactNode
}) {
	return (
		<Card padding="md">
			<div className="hidden min-[1120px]:flex min-[1120px]:items-end min-[1120px]:justify-between min-[1120px]:gap-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<h1 className="heading-sm">{title}</h1>
						<AccentBadge className="h-6">{badge}</AccentBadge>
					</div>
					<p className="max-w-[660px] body-sm text-secondary">{description}</p>
				</div>
				{action}
			</div>
			<div className="flex flex-col gap-3 min-[1120px]:hidden">
				<div className="flex items-center justify-between gap-2">
					<AccentBadge className="h-6">{badge}</AccentBadge>
					{action}
				</div>
				<div className="flex flex-col gap-1">
					<h1 className="heading-sm">{title}</h1>
					<p className="max-w-[660px] body-sm text-secondary">{description}</p>
				</div>
			</div>
		</Card>
	)
}
