import { parseMessageToRenderModel } from '~/containers/LlamaAI/renderModel'
import type { DuelArmState } from '../hooks/useDuelStream'
import type { Message } from '../types'

// A tool call alone is progress, not an answer; prose or reasoning is. Saved messages carry reasoning
// as `thinking`, live and committed ones as steps. Artifacts that MessageBubble can render without
// prose are answers once their arm has settled.
function hasTextAnswer(message: Message | null) {
	if (!message) return false
	if (message.content?.trim() || message.thinking?.trim()) return true
	return (message.steps ?? []).some((step) => step.kind === 'reasoning' && step.text.trim())
}

/** Progress worth showing instead of the loading placeholder while an arm streams. */
export function hasDuelProgress(message: Message | null) {
	return hasTextAnswer(message) || (message?.steps?.length ?? 0) > 0
}

export function hasDuelAnswer(message: Message | null) {
	if (!message) return false
	if (hasTextAnswer(message)) return true
	// Match the read-only MessageBubble: alerts are intentionally hidden, while
	// out-of-band artifacts and legacy sources receive fallback render blocks.
	return parseMessageToRenderModel({ ...message, content: undefined, alerts: undefined }).blocks.length > 0
}

export type DuelArmStatus = 'streaming' | 'answered' | 'interrupted'

// `isStreaming` stays true while the turn reconnects and turns false however it ends, so an arm without its
// own `response_end` is still arriving while the turn streams and was cut off once it stops.
export function getDuelArmStatus(arm: DuelArmState, isStreaming: boolean): DuelArmStatus {
	if (arm.answered) return 'answered'
	return isStreaming ? 'streaming' : 'interrupted'
}

// Choosing an answer switches the thread onto that sibling, and the branch loader
// refuses to run mid-turn, so the vote opens only once the turn has settled. Both answers
// must exist for a preference to mean anything — an arm that failed is not a comparison.
export function canVoteOnDuel(a: DuelArmState, b: DuelArmState, isStreaming: boolean, canResolve: boolean) {
	return canResolve && !isStreaming && !a.error && !b.error && hasDuelAnswer(a.message) && hasDuelAnswer(b.message)
}
