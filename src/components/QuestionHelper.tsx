import { Icon } from '~/components/Icon'
import { Tooltip } from '~/ui/Tooltip'

export function QuestionHelper({
	text,
	disabled,
	className,
	...props
}: {
	text: string
	disabled?: boolean
	className?: string
}) {
	return (
		<Tooltip content={disabled ? null : text}>
			<Icon
				name="help-circle"
				height={16}
				width={16}
				className={`text-tertiary ${className ?? ''}`.trim()}
				{...props}
			/>
		</Tooltip>
	)
}
