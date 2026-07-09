import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'

export function MarketsPageHeader({
	title,
	meta,
	description,
	backHref = '/markets',
	backLabel = 'Markets',
	showBack = true
}: {
	title: ReactNode
	meta?: ReactNode
	description?: ReactNode
	backHref?: string
	backLabel?: string
	showBack?: boolean
}) {
	return (
		<Card as="header" padding="strip" className="flex flex-col gap-3">
			{showBack ? (
				<BasicLink href={backHref} shallow className="w-fit label-md text-link hover:underline">
					← {backLabel}
				</BasicLink>
			) : null}
			<div className="flex flex-col gap-1.5">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<h1 className="heading-sm capitalize">{title}</h1>
					{meta}
				</div>
				{description ? <p className="body-sm text-secondary">{description}</p> : null}
			</div>
		</Card>
	)
}
