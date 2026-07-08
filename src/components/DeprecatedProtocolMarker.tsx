import { DeprecatedEntityMarker } from '~/components/DeprecatedEntityMarker'

interface DeprecatedProtocolMarkerProps {
	size?: number
	className?: string
	content?: string
}

export function DeprecatedProtocolMarker({
	size = 14,
	className = '',
	content = 'Deprecated protocol'
}: DeprecatedProtocolMarkerProps) {
	return <DeprecatedEntityMarker size={size} className={className} content={content} />
}
