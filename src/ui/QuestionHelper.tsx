import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

export function QuestionHelper({ text, className }: { text: string; className?: string }) {
	return (
		<Tooltip content={text}>
			<Icon name="help-circle" className={`size-4 text-tertiary ${className ?? ''}`.trim()} />
		</Tooltip>
	)
}
