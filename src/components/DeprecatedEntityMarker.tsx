import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

interface DeprecatedEntityMarkerProps {
	size?: `size-${number}`
	className?: string
	content?: string
}

export function DeprecatedEntityMarker({
	size = 'size-3.5',
	className = '',
	content = 'Deprecated'
}: DeprecatedEntityMarkerProps) {
	return (
		<Tooltip content={content} className={`text-error ${className}`}>
			<Icon name="alert-triangle" className={size} aria-hidden="true" />
			<span className="sr-only">{content}</span>
		</Tooltip>
	)
}

export function DeprecatedEntityText({ label = 'Deprecated', className = '' }: { label?: string; className?: string }) {
	return <span className={`shrink-0 label-md text-error ${className}`.trim()}>{label}</span>
}
