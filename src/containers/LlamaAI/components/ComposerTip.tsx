import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { focusComposerOnLeave } from './ComposerTray'

/**
 * A notice under the composer that the reader can act on or put away: a product tip, the browser notification
 * prompt, a low balance. Every one is this strip: Card's one-line row, the sentence, at most one secondary action
 * and Dismiss. The action stays secondary because the composer's Send is the view's one primary button. Below 16rem
 * the sentence takes the first line and the buttons wrap under it, so the text never squeezes into a sliver.
 * Dismissing it, or the action that removes it, hands focus to the composer (focusComposerOnLeave). `onShow` reports
 * a tip's impression from the strip's ref callback. The callback is inline, so React calls it again on every
 * re-render: `onShow` must be safe to repeat (markSeen sends each tip's impression once). `dismissLabel` names what
 * Dismiss removes, because the button's visible mark is only an x.
 */
export function ComposerTip({
	message,
	action,
	dismissLabel,
	onDismiss,
	onShow
}: {
	message: string
	action?: { label: string; onClick: () => void; disabled?: boolean }
	dismissLabel: string
	onDismiss: () => void
	onShow?: () => void
}) {
	return (
		<Card
			ref={(node: HTMLDivElement | null) => {
				if (node) onShow?.()
				return focusComposerOnLeave(node)
			}}
			padding="row"
			className="flex flex-wrap items-center gap-x-3 gap-y-2"
		>
			<p className="m-0 grow basis-64 body-sm text-secondary">{message}</p>
			{action ? (
				// A press that disables it (the browser's permission prompt is open) keeps focus and swallows a second press.
				<Button
					variant="secondary"
					size="md"
					onClick={action.onClick}
					disabled={action.disabled}
					accessibleWhenDisabled
				>
					{action.label}
				</Button>
			) : null}
			<Tooltip
				content="Dismiss"
				render={<Button type="button" variant="ghost" size="md" square onClick={onDismiss} aria-label={dismissLabel} />}
			>
				<Icon name="x" className="size-4" />
			</Tooltip>
		</Card>
	)
}
