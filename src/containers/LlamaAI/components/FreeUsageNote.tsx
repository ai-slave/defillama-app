import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import type { FreeUsage } from '~/containers/LlamaAI/types'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { Button } from '~/ui/Button'
import { passFocusOnLeave, pageContent } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export type FreeUsageNoteState =
	| { kind: 'none' }
	| { kind: 'welcome'; remaining: number; limit: number; resetTime?: string; endsAt: string | null }
	| { kind: 'last-question'; resetTime?: string }
	| { kind: 'typed-used'; resetTime?: string }
	| { kind: 'all-used'; resetTime?: string }

/**
 * Which free-plan note to show. The welcome-week card is the sidebar's (`showBonus`); a dismissed card comes back
 * for the last question and the used-up day. The slot under the phone input shows only the low states.
 */
export function getFreeUsageNote(
	usage: FreeUsage | null | undefined,
	showBonus: boolean,
	bonusDismissed: boolean
): FreeUsageNoteState {
	const typed = usage?.typed
	if (!typed) return { kind: 'none' }
	if (showBonus && usage.bonus) {
		if (bonusDismissed && typed.remaining > 1) return { kind: 'none' }
		return {
			kind: 'welcome',
			remaining: typed.remaining,
			limit: typed.limit,
			resetTime: typed.resetTime,
			endsAt: usage.bonus.endsAt
		}
	}
	if (typed.remaining === 0) {
		return (usage.suggested?.remaining ?? 0) > 0
			? { kind: 'typed-used', resetTime: typed.resetTime }
			: { kind: 'all-used', resetTime: typed.resetTime }
	}
	if (typed.remaining === 1 && typed.limit > 1) return { kind: 'last-question', resetTime: typed.resetTime }
	return { kind: 'none' }
}

/** The phone composer's placeholder: during the welcome week it carries today's count, since the sidebar card is off screen. */
export function getPhonePromptPlaceholder(usage: FreeUsage | null | undefined): string {
	const typed = usage?.typed
	return usage?.bonus && typed && typed.remaining >= 2
		? `Ask LlamaAI · ${typed.remaining} of ${typed.limit} left today`
		: 'Ask LlamaAI…'
}

/* The storage store re-renders its readers a task after the write, so the card leaves after the dismiss handler
   returns; the button hands focus on as it leaves. Nothing nearer survives the card. */
const focusPageOnLeave = passFocusOnLeave(pageContent)

const dismissKey = (userId: string) => `llamaai-welcome-bonus-dismissed:${userId}`

export function FreeUsageNote({
	usage,
	showBonus,
	className
}: {
	usage: FreeUsage | null | undefined
	showBonus: boolean
	className: string
}) {
	const userId = useAuthContext().user?.id ?? null
	// Usage arrives only for a signed-in reader, so the key without a user is never written.
	const dismissed = useStorageItem(dismissKey(userId ?? 'signed-out'), null) === 'true'
	const note = getFreeUsageNote(usage, showBonus, dismissed)

	if (note.kind === 'none') return null
	if (note.kind === 'welcome') {
		return (
			<div className={className}>
				<WelcomeWeekCard
					note={note}
					onDismiss={() => {
						trackUmamiEvent('llamaai-welcome-card-dismiss', { remaining: note.remaining })
						if (userId) setStorageItem(dismissKey(userId), 'true')
					}}
				/>
			</div>
		)
	}

	const resets = note.resetTime ? (
		<>
			{' · '}
			<RelativeTime value={note.resetTime} prefix="resets" />
		</>
	) : null
	return (
		<p className={`body-sm text-secondary ${className}`}>
			{note.kind === 'last-question'
				? '1 free question left today'
				: note.kind === 'typed-used'
					? "Today's free question is used"
					: "You've used today's free questions"}
			{resets}
			{note.kind === 'all-used' ? (
				<>
					{' · '}
					<BasicLink
						href="/subscription"
						data-umami-event="llamaai-usage-note-trial-click"
						data-umami-event-state="no-bonus"
						className="font-medium text-link hover:underline"
					>
						Try Pro free
					</BasicLink>
				</>
			) : null}
		</p>
	)
}

function WelcomeWeekCard({
	note: { remaining, limit, resetTime, endsAt },
	onDismiss
}: {
	note: Extract<FreeUsageNoteState, { kind: 'welcome' }>
	onDismiss: () => void
}) {
	const resets = resetTime ? <RelativeTime value={resetTime} prefix={remaining === 0 ? 'Resets' : 'resets'} /> : null

	return (
		<div className="flex flex-col gap-2 py-1">
			<div className="flex items-center gap-2">
				<p className="min-w-0 flex-1 body-sm text-tertiary">
					{remaining === 0 ? (
						resets
					) : (
						<>
							Welcome week ·{' '}
							{remaining === 1 && resets ? (
								resets
							) : endsAt ? (
								<RelativeTime value={endsAt} prefix="ends" />
							) : (
								'starts when you ask'
							)}
						</>
					)}
				</p>
				{remaining === 0 ? (
					<BasicLink
						href="/subscription"
						data-umami-event="llamaai-usage-note-trial-click"
						data-umami-event-state="welcome-week"
						className="-my-1 shrink-0 label-sm text-link hover:underline"
					>
						Try Pro free
					</BasicLink>
				) : remaining > 1 ? (
					<Tooltip
						content="Dismiss"
						render={
							<Button
								type="button"
								variant="ghost"
								size="sm"
								square
								ref={focusPageOnLeave}
								onClick={onDismiss}
								aria-label="Dismiss welcome week"
								className="-my-1 -mr-1"
							/>
						}
					>
						<Icon name="x" height={16} width={16} />
					</Tooltip>
				) : null}
			</div>
			<p className="label-sm text-primary">
				{remaining === 0 ? (
					"Today's questions are used"
				) : remaining === 1 ? (
					'1 question left today'
				) : (
					<>
						<span className="tabular-nums">{remaining}</span> of <span className="tabular-nums">{limit}</span> questions
						left today
					</>
				)}
			</p>
			<div
				role="meter"
				aria-label="Questions left today"
				aria-valuemin={0}
				aria-valuemax={limit}
				aria-valuenow={remaining}
				className="flex gap-1"
			>
				{Array.from({ length: limit }, (_, i) => (
					<span
						key={i}
						data-state={i < remaining ? 'remaining' : 'used'}
						className={`h-1 flex-1 rounded-full ${i < remaining ? 'bg-ai-gold' : 'bg-surface-elevated-2'}`}
					/>
				))}
			</div>
		</div>
	)
}
