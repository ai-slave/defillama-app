import { formattedNum } from '~/utils'

export const BreakdownTooltipContent = ({
	breakdown,
	description
}: {
	breakdown: Array<[string, number]>
	description: string
}) => (
	<span className="flex flex-col gap-1">
		<span className="body-sm text-secondary">{description}</span>
		{breakdown.map(([chain, tvl]) => (
			<span key={`${chain}-${tvl}`}>
				{chain}: {formattedNum(tvl, true)}
			</span>
		))}
	</span>
)
