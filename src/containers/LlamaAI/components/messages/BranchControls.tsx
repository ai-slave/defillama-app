import type { Message } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'

export function BranchArrows({
	info,
	onSwitch,
	disabled = false
}: {
	info: NonNullable<Message['siblingInfo']>
	onSwitch: (leafMessageId: string) => void
	disabled?: boolean
}) {
	const { currentVersion, totalVersions, siblings } = info
	const goPrev = currentVersion > 1 ? siblings[currentVersion - 2]?.leafMessageId : null
	const goNext = currentVersion < totalVersions ? siblings[currentVersion]?.leafMessageId : null
	return (
		<div className="flex items-center gap-0.5">
			<Tooltip
				content="Previous version"
				render={
					<Button
						variant="ghost"
						size="sm"
						square
						// Stepping to the first or last version disables the arrow just pressed; it keeps focus.
						accessibleWhenDisabled
						disabled={disabled || !goPrev}
						onClick={() => !disabled && goPrev && onSwitch(goPrev)}
						aria-label="Previous version"
					/>
				}
			>
				<Icon name="chevron-left" className="size-4" />
			</Tooltip>
			<span className="px-0.5 body-sm text-tertiary tabular-nums">
				{currentVersion}/{totalVersions}
			</span>
			<Tooltip
				content="Next version"
				render={
					<Button
						variant="ghost"
						size="sm"
						square
						// Stepping to the first or last version disables the arrow just pressed; it keeps focus.
						accessibleWhenDisabled
						disabled={disabled || !goNext}
						onClick={() => !disabled && goNext && onSwitch(goNext)}
						aria-label="Next version"
					/>
				}
			>
				<Icon name="chevron-right" className="size-4" />
			</Tooltip>
		</div>
	)
}
