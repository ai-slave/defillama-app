import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

export function RWASuspiciousWarning({
	reason,
	entity = 'asset'
}: {
	reason?: string | null
	entity?: 'asset' | 'market'
}) {
	const scope = entity === 'market' ? 'cross-venue' : 'global'
	const explanation = `This ${entity} is marked as suspicious and is excluded from ${scope} totals and charts.`
	const warning = reason ? `${explanation}\n\nReason: ${reason}` : explanation
	return (
		<Tooltip
			content={warning}
			// A status mark, not an action: focusable so keyboard readers can open the explanation.
			render={<span role="img" aria-label={warning} className="cursor-help text-warning" />}
			tabIndex={0}
		>
			<Icon name="alert-triangle" height={16} width={16} aria-hidden="true" />
		</Tooltip>
	)
}
