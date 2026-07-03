import type { ReactNode } from 'react'
import { TimeframeBadge } from './badges'
import { ArrowRightIcon } from './icons'

export function RfqButton() {
	return (
		<a
			href="https://www.forgd.com/tools/engage-a-market-maker"
			target="_blank"
			rel="noreferrer noopener"
			className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#030021] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
		>
			<span className="hidden min-[713px]:inline">Conduct a Market Maker RFQ</span>
			<span className="min-[713px]:hidden">Conduct an RFQ</span>
			<ArrowRightIcon />
		</a>
	)
}

export function DocsActionButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-(--form-control-border) px-3 py-1.5 text-sm font-medium text-(--text-primary) hover:bg-(--link-hover-bg)"
		>
			Documentation
			<ArrowRightIcon />
		</button>
	)
}

export function AboutButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-(--form-control-border) px-3 py-1.5 text-sm font-medium text-(--text-primary) hover:bg-(--link-hover-bg)"
		>
			<span className="hidden min-[713px]:inline">About this Leaderboard</span>
			<span className="min-[713px]:hidden">About</span>
			<ArrowRightIcon />
		</button>
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
		<div className="rounded-md bg-(--cards-bg) p-4">
			<div className="hidden min-[1120px]:flex min-[1120px]:items-end min-[1120px]:justify-between min-[1120px]:gap-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<h1 className="text-xl font-semibold">{title}</h1>
						<TimeframeBadge label={badge} />
					</div>
					<p className="max-w-[660px] text-sm text-(--text-secondary)">{description}</p>
				</div>
				{action}
			</div>
			<div className="flex flex-col gap-3 min-[1120px]:hidden">
				<div className="flex items-center justify-between gap-2">
					<TimeframeBadge label={badge} />
					{action}
				</div>
				<div className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold">{title}</h1>
					<p className="max-w-[660px] text-sm text-(--text-secondary)">{description}</p>
				</div>
			</div>
		</div>
	)
}
