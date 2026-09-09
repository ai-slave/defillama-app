import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'

export type SubmitButtonMode =
	| { kind: 'send'; disabled: boolean }
	| { kind: 'queue'; disabled: boolean }
	| { kind: 'streaming'; canQueue: boolean; onStop: () => void }
	| { kind: 'stopping' }

export function SubmitButton({ mode }: { mode: SubmitButtonMode }) {
	if (mode.kind === 'queue') {
		return (
			<Tooltip
				content="Queue — sends when earlier messages finish"
				render={<button type="submit" disabled={mode.disabled} data-umami-event="llamaai-queue-submit" />}
				className="flex size-7 items-center justify-center rounded-lg bg-brand/12 text-brand hover:bg-brand/25 disabled:opacity-25"
			>
				<Icon name="arrow-up" height={14} width={14} className="@sm:size-4" />
				<span className="sr-only">Queue message</span>
			</Tooltip>
		)
	}

	if (mode.kind === 'streaming') {
		return (
			<>
				{mode.canQueue ? (
					<Tooltip
						content="Queue — sends when this response finishes"
						render={<button type="submit" data-umami-event="llamaai-queue-submit" />}
						className="flex size-7 items-center justify-center rounded-lg bg-brand/12 text-brand hover:bg-brand/25"
					>
						<Icon name="arrow-up" height={14} width={14} className="@sm:size-4" />
						<span className="sr-only">Queue message</span>
					</Tooltip>
				) : null}
				<Tooltip
					content="Stop"
					render={<button type="button" onClick={mode.onStop} data-umami-event="llamaai-stop-generation" />}
					className="group flex size-7 items-center justify-center rounded-lg bg-brand/12 hover:bg-brand"
				>
					<span className="block size-2 bg-brand group-hover:bg-ai-white group-focus-visible:bg-ai-white sm:size-2.5" />
					<span className="sr-only">Stop</span>
				</Tooltip>
			</>
		)
	}

	if (mode.kind === 'stopping') {
		return (
			<Tooltip
				content="Stopping…"
				render={<button type="button" disabled data-umami-event="llamaai-stop-generation" />}
				className="group flex size-7 items-center justify-center rounded-lg bg-brand/12 hover:bg-brand"
			>
				<LoadingSpinner size={14} />
				<span className="sr-only">Stopping</span>
			</Tooltip>
		)
	}

	return (
		<button
			type="submit"
			data-umami-event="llamaai-prompt-submit"
			className="flex size-7 items-center justify-center gap-2 rounded-lg bg-brand text-ai-white hover:bg-brand/80 focus-visible:bg-brand/80 disabled:opacity-25"
			disabled={mode.disabled}
		>
			<Icon name="arrow-up" height={14} width={14} className="@sm:size-4" />
			<span className="sr-only">Submit prompt</span>
		</button>
	)
}
