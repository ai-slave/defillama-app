import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

interface WebsiteGlobeLinkProps {
	url: string
	name: string
	event: string
	eventData: Record<string, string>
	size?: 'sm' | 'md'
	className?: string
}

export function WebsiteGlobeLink({ url, name, event, eventData, size = 'md', className }: WebsiteGlobeLinkProps) {
	const umamiAttributes = Object.fromEntries(
		Object.entries(eventData).map(([key, value]) => [`data-umami-event-${key}`, value])
	)
	const label = `Open ${name} website`

	return (
		<Tooltip
			content={label}
			className={className}
			render={
				<Button
					as="a"
					variant="ghost"
					size={size}
					square
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={label}
					{...umamiAttributes}
					data-umami-event={event}
					data-umami-event-placement="header"
					data-umami-event-url={url}
				/>
			}
		>
			<Icon name="globe" className="size-4" />
		</Tooltip>
	)
}
