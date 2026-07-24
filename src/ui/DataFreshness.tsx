import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'

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
			<RelativeTime value={timestamp} input="seconds" prefix={label} />
		</p>
	)
}
