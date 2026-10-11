import { useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import type { DuelArmState } from '../hooks/useDuelStream'
import type { Message } from '../types'
import { canVoteOnDuel, getDuelArmStatus, hasDuelAnswer, hasDuelProgress, type DuelArmStatus } from './duelVoting'
import { MessageBubble } from './messages/MessageBubble'
import { ChatStatusLine } from './status/ChatStatusLine'

export type DuelChoice = 'a' | 'b' | 'tie' | 'both_bad'

interface DuelPanelProps {
	a: DuelArmState
	b: DuelArmState
	sessionId: string | null
	isStreaming: boolean
	/** The server confirmed both answers are persisted; until then neither can be resolved. */
	canResolve: boolean
	onVote: (choice: DuelChoice) => void
}

function AnswerColumn({
	label,
	message,
	sessionId,
	status,
	error,
	hasAnswer,
	canChoose,
	onChoose
}: {
	label: string
	message: Message | null
	sessionId: string | null
	status: DuelArmStatus
	error: string | null
	hasAnswer: boolean
	canChoose: boolean
	onChoose: () => void
}) {
	const isStreaming = status === 'streaming'
	// Out-of-band artifacts receive fallback blocks only after streaming settles.
	const hasVisibleContent = isStreaming ? hasDuelProgress(message) : hasAnswer
	// What the arm produced stays on screen; the line says why it is not a final answer.
	const statusText = error ?? (status === 'interrupted' ? 'This response was interrupted.' : null)

	return (
		<section aria-label={label} className="flex min-w-0 flex-1 flex-col rounded-lg border border-subtle bg-surface">
			<div className="flex items-center gap-2 px-4 pt-3 pb-1">
				<span className="label-sm text-secondary">{label}</span>
				{isStreaming ? <span className="size-1.5 rounded-full bg-brand motion-safe:animate-pulse" aria-hidden /> : null}
			</div>

			<div className="min-w-0 grow overflow-x-auto px-4 pb-2">
				{message ? (
					<MessageBubble message={message} sessionId={sessionId} readOnly hideControls isDraft={isStreaming} />
				) : null}
				{statusText ? (
					<div className="py-3">
						<ChatStatusLine variant="error" align="start">
							{statusText}
						</ChatStatusLine>
					</div>
				) : !hasVisibleContent ? (
					<div role="status" aria-live="polite" className="py-3">
						<LoadingIndicator label={`Waiting for ${label}`} />
					</div>
				) : null}
			</div>

			<div className="px-4 pt-1 pb-3">
				<Button
					type="button"
					size="md"
					aria-label={`I prefer ${label}`}
					disabled={!canChoose || !hasVisibleContent}
					// Voting closes every choice, this one included; it keeps focus.
					accessibleWhenDisabled
					onClick={onChoose}
					className="w-full"
				>
					<Icon name="check" className="size-3.5" />
					I prefer this response
				</Button>
			</div>
		</section>
	)
}

export function DuelPanel({ a, b, sessionId, isStreaming, canResolve, onVote }: DuelPanelProps) {
	const [voted, setVoted] = useState(false)
	const aHasAnswer = hasDuelAnswer(a.message)
	const bHasAnswer = hasDuelAnswer(b.message)
	const canVote = canVoteOnDuel(a, b, isStreaming, canResolve)

	const handleVote = (choice: DuelChoice) => {
		if (voted) return
		setVoted(true)
		onVote(choice)
	}

	return (
		<div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 px-2 py-6">
			<header className="flex flex-col items-center gap-1 text-center">
				<h2 className="label-lg">You’re giving feedback on a new version of LlamaAI.</h2>
				<p className="body-md text-secondary">Which response do you prefer? Responses may take a moment to load.</p>
			</header>

			<div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
				<AnswerColumn
					label="Response 1"
					message={a.message}
					sessionId={sessionId}
					status={getDuelArmStatus(a, isStreaming)}
					error={a.error}
					hasAnswer={aHasAnswer}
					canChoose={canVote && !voted}
					onChoose={() => handleVote('a')}
				/>
				<AnswerColumn
					label="Response 2"
					message={b.message}
					sessionId={sessionId}
					status={getDuelArmStatus(b, isStreaming)}
					error={b.error}
					hasAnswer={bHasAnswer}
					canChoose={canVote && !voted}
					onChoose={() => handleVote('b')}
				/>
			</div>

			<div className="flex items-center justify-center gap-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={!canVote || voted}
					accessibleWhenDisabled
					onClick={() => handleVote('tie')}
				>
					They’re about the same
				</Button>
				<span aria-hidden className="text-tertiary">
					·
				</span>
				<Button
					variant="ghost"
					size="sm"
					disabled={!canVote || voted}
					accessibleWhenDisabled
					onClick={() => handleVote('both_bad')}
				>
					Neither is good
				</Button>
			</div>
		</div>
	)
}
