import { Icon } from '~/components/Icon'
import { toNiceDateYear } from '~/utils'

export function DataFreshness({
	timestamp,
	label = 'Data last updated',
	className
}: {
	timestamp: number
	label?: string
	className?: string
}) {
	return (
		<p className={`flex items-center gap-1.5 text-sm text-warning ${className ?? ''}`.trim()}>
			<Icon name="alert-triangle" height={14} width={14} className="shrink-0" />
			<span>
				{label} {toNiceDateYear(timestamp)}
			</span>
		</p>
	)
}
