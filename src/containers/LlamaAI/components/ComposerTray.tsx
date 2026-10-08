import type { ReactNode } from 'react'
import { passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'

/** The composer's prompt field. One chat page has one. */
export const composerField = () => document.querySelector<HTMLTextAreaElement>('textarea[name="prompt"]')

/** A ref for a notice around the composer that its own action or new state removes (a dismissed tip, a retried
    prompt): when it leaves holding focus, the composer's prompt field takes it. */
export const focusComposerOnLeave = passFocusOnLeave(composerField)

/**
 * A strip docked on the composer's top edge for conversation state that blocks or shapes the next prompt, with
 * its actions: a failed prompt, a full queue, a thread near its context limit, most urgent first. It stays out of the
 * input box, so the composer keeps its height, and sits beside the send button whose state it explains. The box
 * holds the draft alone: its text, quote, attachments, upload feedback and an error about sending that draft.
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
			ref={focusComposerOnLeave}
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
