import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'

interface DeprecatedProtocolMarkerProps {
	size?: `size-${number}`
	className?: string
	content?: string
}

export function DeprecatedProtocolMarker({
	size = 'size-3.5',
	className = '',
	content = 'Deprecated protocol'
}: DeprecatedProtocolMarkerProps) {
	return <DeprecatedEntityMarker size={size} className={className} content={content} />
}
