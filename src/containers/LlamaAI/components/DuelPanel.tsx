import { useState } from 'react'
import { parseMessageToRenderModel } from '~/containers/LlamaAI/renderModel'
import { Icon } from '~/ui/Icon'
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

// A tool execution alone is progress, not an answer. Artifacts that MessageBubble can render
// without prose are answers once their arm has settled.
function hasTextAnswer(message: Message | null) {
	return Boolean(message?.content?.trim() || message?.thinking?.trim())
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
	const hasVisibleContent = isStreaming ? hasTextAnswer(message) : hasAnswer

	return (
		<section aria-label={label} className="flex min-w-0 flex-1 flex-col rounded-xl border border-ai-line bg-surface">
			<div className="flex items-center gap-2 px-4 pt-3 pb-1">
				<span className="text-xs font-medium text-ai-secondary">{label}</span>
				{isStreaming ? <span className="size-1.5 animate-pulse rounded-full bg-ai-line-strong" aria-hidden /> : null}
			</div>

			<div className="min-w-0 grow overflow-x-auto px-4 pb-2">
				{error ? <p className="py-3 text-sm text-ai-error">{error}</p> : null}
				{!error && message ? (
					<MessageBubble message={message} sessionId={sessionId} readOnly hideControls isDraft={isStreaming} />
				) : null}
				{!error && !hasVisibleContent ? (
					<div className="flex flex-col gap-2 py-3" aria-label={`${label} is still loading`}>
						<span className="h-3 w-4/5 animate-pulse rounded-sm bg-ai-skeleton" />
						<span className="h-3 w-3/5 animate-pulse rounded-sm bg-ai-skeleton" />
					</div>
				) : null}
			</div>

			<div className="px-4 pt-1 pb-3">
				<button
					type="button"
					aria-label={`I prefer ${label}`}
					disabled={!canChoose || !hasVisibleContent}
					onClick={onChoose}
					className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ai-line bg-ai-surface-muted px-3 py-2 text-sm font-medium transition-colors hover:bg-ai-hover disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Icon name="check" height={14} width={14} />
					I prefer this response
				</button>
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
				<p className="text-sm text-ai-secondary">Which response do you prefer? Responses may take a moment to load.</p>
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

			<div className="flex items-center justify-center gap-4 text-sm text-ai-secondary">
				<button
					type="button"
					disabled={!canVote || voted}
					onClick={() => handleVote('tie')}
					className="underline-offset-4 hover:text-(--text-primary) hover:underline disabled:cursor-not-allowed disabled:opacity-40"
				>
					They’re about the same
				</button>
				<span aria-hidden className="text-ai-line-strong">
					·
				</span>
				<button
					type="button"
					disabled={!canVote || voted}
					onClick={() => handleVote('both_bad')}
					className="underline-offset-4 hover:text-(--text-primary) hover:underline disabled:cursor-not-allowed disabled:opacity-40"
				>
					Neither is good
				</button>
			</div>
		</div>
	)
}
