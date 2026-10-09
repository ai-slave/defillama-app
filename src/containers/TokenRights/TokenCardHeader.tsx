import type { ComponentProps, ReactNode } from 'react'
import { BasicLink } from '~/components/Link'

/** Shared by the token rights and UTR cards: entity name and symbols, then the card's title, with a link slot. */
export function TokenCardHeader({
	name,
	symbols,
	title,
	action
}: {
	name: string
	symbols: Array<string>
	title: string
	action: ReactNode
}) {
	return (
		<div className="flex items-start justify-between gap-2">
			<h3 className="flex min-w-0 flex-col gap-0.5">
				<span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
					<span className="title-md">{name}</span>
					{symbols.map((symbol) => (
						<span key={symbol} className="label-sm text-secondary">
							${symbol}
						</span>
					))}
				</span>
				<span className="label-sm text-secondary">{title}</span>
			</h3>
			{action}
		</div>
	)
}

/** The header's small bordered link from one card to the other's full page: UTR grade on the rights card, rights pie on
    the UTR card. One recipe, so the two cards link to each other the same way. */
export function TokenCardLink(props: Omit<ComponentProps<typeof BasicLink>, 'className'>) {
	return (
		<BasicLink
			{...props}
			className="hover-wash flex shrink-0 flex-col items-end gap-0.5 rounded-md border border-subtle px-1.5 py-1 label-xs text-tertiary"
		/>
	)
}
