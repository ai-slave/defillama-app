import { type ReactNode, useCallback, useRef, useState } from 'react'
import { InlineStatus } from '~/ui/Status'

/* The preview modals report what Copy, Copy link, Download and Save preset did on the modal itself, never in a toast
   over it. A success shows on the pressed button for two seconds (under the header on phones, where the button is in
   a closed menu) and is announced politely; a failure keeps its reason under the header until the next action. */

type ActionOutcome = { action: string; ok: boolean; message: string }

export function useActionFeedback() {
	const [outcome, setOutcome] = useState<ActionOutcome | null>(null)
	const timerRef = useRef(0)
	// Stable, so the modals' memoized handlers can report without re-creating themselves.
	const report = useCallback((action: string, ok: boolean, message: string) => {
		window.clearTimeout(timerRef.current)
		setOutcome({ action, ok, message })
		if (ok) timerRef.current = window.setTimeout(() => setOutcome(null), 2000)
	}, [])
	return {
		outcome,
		report,
		/** Whether the button for `action` shows its confirmation right now. */
		confirmed: (action: string) => outcome?.ok === true && outcome.action === action
	}
}

// On phones these actions sit in the More actions menu, which closes on the press, so their success shows in the band
// instead of on a button. Download stays in the header and confirms on itself.
const PHONE_MENU_ACTIONS = new Set(['copy', 'save-preset', 'copy-link'])

/** The header's status band: the polite announcement of each success, and the reason for a failure. */
export function ActionFeedbackStatus({ outcome }: { outcome: ActionOutcome | null }) {
	return (
		<>
			{/* Mounted before any message arrives, so screen readers announce each one. */}
			<span role="status" className="sr-only">
				{outcome?.ok ? outcome.message : ''}
			</span>
			{outcome?.ok && PHONE_MENU_ACTIONS.has(outcome.action) ? (
				// Already announced by the status above.
				<p aria-hidden className="shrink-0 border-b border-subtle px-4 py-2 body-sm text-secondary sm:hidden">
					{outcome.message}
				</p>
			) : null}
			{outcome && !outcome.ok ? (
				<div className="shrink-0 border-b border-subtle px-4 py-2">
					<InlineStatus variant="error">{outcome.message}</InlineStatus>
				</div>
			) : null}
		</>
	)
}

/** A button's idle and confirmed content in one grid cell, so the button keeps its width while it confirms. The idle
    content stays in the accessibility tree and keeps the button's name; the status announces the confirmation. */
export function ConfirmableContent({
	confirmed,
	idle,
	done
}: {
	confirmed: boolean
	idle: ReactNode
	done: ReactNode
}) {
	return (
		<span className="grid">
			<span
				className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 ${confirmed ? 'opacity-0' : ''}`}
			>
				{idle}
			</span>
			<span
				aria-hidden
				className={`col-start-1 row-start-1 flex items-center justify-center gap-1.5 ${confirmed ? '' : 'invisible'}`}
			>
				{done}
			</span>
		</span>
	)
}
