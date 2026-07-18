import { Icon } from '~/components/Icon'
import type { Message } from '~/containers/LlamaAI/types'
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
	const arrowClass =
		'rounded-md p-1.5 text-ai-muted transition-colors hover:bg-ai-hover hover:text-ai-secondary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ai-muted'
	return (
		<div className="flex items-center gap-0.5">
			<Tooltip
				content="Previous version"
				render={
					<button
						type="button"
						disabled={disabled || !goPrev}
						onClick={() => !disabled && goPrev && onSwitch(goPrev)}
						aria-label="Previous version"
					/>
				}
				className={arrowClass}
			>
				<Icon name="chevron-left" height={14} width={14} />
			</Tooltip>
			<span className="px-0.5 text-[11px] text-ai-muted tabular-nums">
				{currentVersion}
				<span className="opacity-50">/{totalVersions}</span>
			</span>
			<Tooltip
				content="Next version"
				render={
					<button
						type="button"
						disabled={disabled || !goNext}
						onClick={() => !disabled && goNext && onSwitch(goNext)}
						aria-label="Next version"
					/>
				}
				className={arrowClass}
			>
				<Icon name="chevron-right" height={14} width={14} />
			</Tooltip>
		</div>
	)
}
