import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'

export function DataFreshness({
	timestamp,
	label,
	className
}: {
	timestamp: number
	label: string
	className?: string
}) {
	return (
		<p className={`flex items-center gap-1.5 body-md text-warning ${className ?? ''}`.trim()}>
			<Icon name="alert-triangle" className="size-3.5 shrink-0" />
			<RelativeTime value={timestamp} input="seconds" prefix={label} />
		</p>
	)
}
