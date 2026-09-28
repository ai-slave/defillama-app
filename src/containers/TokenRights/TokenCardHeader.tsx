import type { ReactNode } from 'react'

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
					<span className="text-sm leading-tight font-semibold sm:text-base">{name}</span>
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
