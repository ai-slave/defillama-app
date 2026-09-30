import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'

/**
 * A strip docked on the composer's top edge for conversation state that blocks or shapes the next prompt, with
 * its actions: a failed prompt, a thread near its context limit. It stays out of the input box, so the composer
 * keeps its height, and sits beside the send button whose state it explains.
 */
export function ComposerTray({
	tone,
	actions,
	children
}: {
	tone: 'error' | 'warning'
	actions?: ReactNode
	children: ReactNode
}) {
	return (
		<div
			role="status"
			data-composer-tray=""
			// Full width with the negative margin cancelling the column's gap: the strip becomes the composer's header,
			// its edges line up with the queued prompts above, and the composer squares its top corners to meet it.
			className="-mb-2 flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-t-lg border border-b-0 border-medium bg-surface-elevated-1 px-3 py-1.5 body-sm text-secondary"
		>
			{/* The text keeps its own width, so a long message pushes the actions onto their own line
			    instead of squeezing into a narrow column beside them. */}
			<span className="flex min-w-0 flex-[1_1_auto] items-start gap-1.5">
				<Icon
					name="alert-triangle"
					className={`mt-0.5 size-3.5 shrink-0 ${tone === 'error' ? 'text-data-down' : 'text-warning'}`}
				/>
				<span className="min-w-0">{children}</span>
			</span>
			{actions ? <span className="ml-auto flex shrink-0 items-center gap-1">{actions}</span> : null}
		</div>
	)
}
