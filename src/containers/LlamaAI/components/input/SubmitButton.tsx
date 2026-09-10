import { Button } from '~/ui/Button'
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
				render={
					<Button
						type="submit"
						size="md"
						variant="outline"
						square
						disabled={mode.disabled}
						data-umami-event="llamaai-queue-submit"
					/>
				}
			>
				<Icon name="arrow-up" height={16} width={16} />
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
						render={<Button type="submit" size="md" variant="outline" square data-umami-event="llamaai-queue-submit" />}
					>
						<Icon name="arrow-up" height={16} width={16} />
						<span className="sr-only">Queue message</span>
					</Tooltip>
				) : null}
				<Tooltip
					content="Stop"
					render={
						<Button
							type="button"
							size="md"
							variant="primary"
							square
							onClick={mode.onStop}
							data-umami-event="llamaai-stop-generation"
						/>
					}
				>
					<span className="block size-2.5 rounded-xs bg-on-brand" />
					<span className="sr-only">Stop</span>
				</Tooltip>
			</>
		)
	}

	if (mode.kind === 'stopping') {
		return (
			<Tooltip
				content="Stopping…"
				render={
					<Button
						type="button"
						size="md"
						variant="outline"
						square
						disabled
						data-umami-event="llamaai-stop-generation"
					/>
				}
			>
				<LoadingSpinner size={14} />
				<span className="sr-only">Stopping</span>
			</Tooltip>
		)
	}

	return (
		<Button
			type="submit"
			size="md"
			variant="primary"
			square
			data-umami-event="llamaai-prompt-submit"
			disabled={mode.disabled}
		>
			<Icon name="arrow-up" height={16} width={16} />
			<span className="sr-only">Submit prompt</span>
		</Button>
	)
}
