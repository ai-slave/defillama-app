import { Tooltip } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import type { RaisesSummary } from './summary'

export function RaisesTotal({ totalUsd, undisclosedCount }: RaisesSummary) {
	if (totalUsd === null) return <>Undisclosed</>
	const amount = formatUsd(totalUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	if (undisclosedCount === 0) return <>{amount}</>
	return (
		<Tooltip
			content={`Sum of disclosed funding amounts. Excludes ${undisclosedCount} ${undisclosedCount === 1 ? 'round with an undisclosed amount' : 'rounds with undisclosed amounts'}, so this is not the complete total.`}
			tabIndex={0}
			render={<span className="cursor-help underline decoration-dotted" />}
		>
			{amount}
		</Tooltip>
	)
}
