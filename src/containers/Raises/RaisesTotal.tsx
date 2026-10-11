import { Definition } from '~/ui/Tooltip'
import { formatUsd } from '~/utils/numberFormat'
import type { RaisesSummary } from './summary'

export function RaisesTotal({ totalUsd, undisclosedCount }: RaisesSummary) {
	if (totalUsd === null) return <>Undisclosed</>
	const amount = formatUsd(totalUsd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	if (undisclosedCount === 0) return <>{amount}</>
	return (
		<Definition
			as="span"
			content={`Sum of disclosed funding amounts. Excludes ${undisclosedCount} ${undisclosedCount === 1 ? 'round with an undisclosed amount' : 'rounds with undisclosed amounts'}, so this is not the complete total.`}
		>
			{amount}
		</Definition>
	)
}
