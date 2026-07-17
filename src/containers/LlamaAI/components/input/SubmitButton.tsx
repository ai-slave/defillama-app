import { Icon } from '~/components/Icon'
import { Tooltip } from '~/ui/Tooltip'

interface SubmitButtonProps {
	isStreaming?: boolean
	isPending: boolean
	hasValue: boolean
	onStop?: () => void
}

export function SubmitButton({ isStreaming, isPending, hasValue, onStop }: SubmitButtonProps) {
	if (isStreaming) {
		return (
			<Tooltip
				content="Stop"
				render={<button type="button" onClick={onStop} data-umami-event="llamaai-stop-generation" />}
				className="group flex size-7 items-center justify-center rounded-lg bg-brand/12 hover:bg-brand"
			>
				<span className="block size-2 bg-brand group-hover:bg-ai-white group-focus-visible:bg-ai-white sm:size-2.5" />
				<span className="sr-only">Stop</span>
			</Tooltip>
		)
	}

	return (
		<button
			type="submit"
			data-umami-event="llamaai-prompt-submit"
			className="flex size-7 items-center justify-center gap-2 rounded-lg bg-brand text-ai-white hover:bg-brand/80 focus-visible:bg-brand/80 disabled:opacity-25"
			disabled={isPending || isStreaming || !hasValue}
		>
			<Icon name="arrow-up" height={14} width={14} className="sm:size-4" />
			<span className="sr-only">Submit prompt</span>
		</button>
	)
}
