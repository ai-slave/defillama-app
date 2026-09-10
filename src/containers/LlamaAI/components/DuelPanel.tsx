import { useState } from 'react'
import { parseMessageToRenderModel } from '~/containers/LlamaAI/renderModel'
import { Button, buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import type { DuelArmState } from '../hooks/useDuelStream'
import type { Message } from '../types'
import { MessageBubble } from './messages/MessageBubble'

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

// A tool call alone is progress, not an answer; prose or reasoning is. Saved messages carry reasoning
// as `thinking`, live and committed ones as steps. Artifacts that MessageBubble can render without
// prose are answers once their arm has settled.
function hasTextAnswer(message: Message | null) {
	if (!message) return false
	if (message.content?.trim() || message.thinking?.trim()) return true
	return (message.steps ?? []).some((step) => step.kind === 'reasoning' && step.text.trim())
}

// Progress worth showing instead of the loading placeholder while an arm streams.
function hasProgress(message: Message | null) {
	return hasTextAnswer(message) || (message?.steps?.length ?? 0) > 0
}

function hasRenderableAnswer(message: Message | null) {
	if (!message) return false
	if (hasTextAnswer(message)) return true
	// Match the read-only MessageBubble below: alerts are intentionally hidden, while
	// out-of-band artifacts and legacy sources receive fallback render blocks.
	return parseMessageToRenderModel({ ...message, content: undefined, alerts: undefined }).blocks.length > 0
}

function AnswerColumn({
	label,
	message,
	sessionId,
	isStreaming,
	error,
	hasAnswer,
	canChoose,
	onChoose
}: {
	label: string
	message: Message | null
	sessionId: string | null
	isStreaming: boolean
	error: string | null
	hasAnswer: boolean
	canChoose: boolean
	onChoose: () => void
}) {
	// Out-of-band artifacts receive fallback blocks only after streaming settles.
	const hasVisibleContent = isStreaming ? hasProgress(message) : hasAnswer

	return (
		<section aria-label={label} className="flex min-w-0 flex-1 flex-col rounded-lg border border-subtle bg-surface">
			<div className="flex items-center gap-2 px-4 pt-3 pb-1">
				<span className="label-sm text-secondary">{label}</span>
				{isStreaming ? <span className="size-1.5 rounded-full bg-brand motion-safe:animate-pulse" aria-hidden /> : null}
			</div>

			<div className="min-w-0 grow overflow-x-auto px-4 pb-2">
				{error ? (
					<p role="alert" className="py-3 text-sm text-error">
						{error}
					</p>
				) : null}
				{!error && message ? (
					<MessageBubble message={message} sessionId={sessionId} readOnly hideControls isDraft={isStreaming} />
				) : null}
				{!error && !hasVisibleContent ? (
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
					onClick={onChoose}
					className="w-full"
				>
					<Icon name="check" height={14} width={14} />
					I prefer this response
				</Button>
			</div>
		</section>
	)
}

export function DuelPanel({ a, b, sessionId, isStreaming, canResolve, onVote }: DuelPanelProps) {
	const [voted, setVoted] = useState(false)
	const aHasAnswer = hasRenderableAnswer(a.message)
	const bHasAnswer = hasRenderableAnswer(b.message)

	// Choosing an answer switches the thread onto that sibling, and the branch loader
	// refuses to run mid-turn, so the vote opens only once the turn has settled. Both answers
	// must exist for a preference to mean anything — an arm that failed is not a comparison.
	const canVote = canResolve && !isStreaming && !a.error && !b.error && aHasAnswer && bHasAnswer

	const handleVote = (choice: DuelChoice) => {
		if (voted) return
		setVoted(true)
		onVote(choice)
	}

	return (
		<div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 px-2 py-6">
			<header className="flex flex-col items-center gap-1 text-center">
				<h2 className="text-base font-medium">You’re giving feedback on a new version of LlamaAI.</h2>
				<p className="text-sm text-secondary">Which response do you prefer? Responses may take a moment to load.</p>
			</header>

			<div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
				<AnswerColumn
					label="Response 1"
					message={a.message}
					sessionId={sessionId}
					isStreaming={a.isStreaming}
					error={a.error}
					hasAnswer={aHasAnswer}
					canChoose={canVote && !voted}
					onChoose={() => handleVote('a')}
				/>
				<AnswerColumn
					label="Response 2"
					message={b.message}
					sessionId={sessionId}
					isStreaming={b.isStreaming}
					error={b.error}
					hasAnswer={bHasAnswer}
					canChoose={canVote && !voted}
					onChoose={() => handleVote('b')}
				/>
			</div>

			<div className="flex items-center justify-center gap-2">
				<button
					type="button"
					disabled={!canVote || voted}
					onClick={() => handleVote('tie')}
					className={buttonStyles({ variant: 'ghost', size: 'sm' })}
				>
					They’re about the same
				</button>
				<span aria-hidden className="text-tertiary">
					·
				</span>
				<button
					type="button"
					disabled={!canVote || voted}
					onClick={() => handleVote('both_bad')}
					className={buttonStyles({ variant: 'ghost', size: 'sm' })}
				>
					Neither is good
				</button>
			</div>
		</div>
	)
}
