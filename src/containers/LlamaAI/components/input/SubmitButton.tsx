import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
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
						accessibleWhenDisabled
						data-umami-event="llamaai-queue-submit"
					/>
				}
			>
				<Icon name="arrow-up" height={16} width={16} />
				<span className="sr-only">Queue message</span>
			</Tooltip>
		)
	}

	// Stop and its pending state are one button, so pressing Stop keeps focus on it while the stop request runs.
	if (mode.kind === 'streaming' || mode.kind === 'stopping') {
		const stopping = mode.kind === 'stopping'
		return (
			<>
				{mode.kind === 'streaming' && mode.canQueue ? (
					<Tooltip
						content="Queue — sends when this response finishes"
						render={<Button type="submit" size="md" variant="outline" square data-umami-event="llamaai-queue-submit" />}
					>
						<Icon name="arrow-up" height={16} width={16} />
						<span className="sr-only">Queue message</span>
					</Tooltip>
				) : null}
				<Tooltip
					content={stopping ? 'Stopping…' : 'Stop'}
					render={
						<Button
							type="button"
							size="md"
							variant={stopping ? 'outline' : 'primary'}
							square
							pendingLabel={stopping ? 'Stopping…' : null}
							onClick={stopping ? undefined : mode.onStop}
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

	return (
		<Button
			type="submit"
			size="md"
			variant="primary"
			square
			data-umami-event="llamaai-prompt-submit"
			disabled={mode.disabled}
			accessibleWhenDisabled
		>
			<Icon name="arrow-up" height={16} width={16} />
			<span className="sr-only">Submit prompt</span>
		</Button>
	)
}
