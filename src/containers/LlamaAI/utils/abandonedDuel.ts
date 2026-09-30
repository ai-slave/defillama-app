import type { Message } from '~/containers/LlamaAI/types'

/**
 * Puts an abandoned duel's saved answer back into the thread. Both answers only ever lived in the duel panel,
 * and the server kept one of them: `armMessageIds` names both, so the client never learns which arm was the
 * default. The answer goes right after the duel's prompt, because the execution that ended the duel may already
 * have added its own prompt below it. A thread without that prompt (an edit truncated it) is left alone.
 */
export function insertAbandonedDuelAnswer(
	messages: Array<Message>,
	saved: Array<Message>,
	armMessageIds: Array<string | null>
): Array<Message> {
	const answerIndex = saved.findIndex((message) => message.id !== undefined && armMessageIds.includes(message.id))
	if (answerIndex < 1) return messages
	const answer = saved[answerIndex]
	if (messages.some((message) => message.id === answer.id)) return messages
	const promptIndex = messages.findIndex((message) => message.id === saved[answerIndex - 1].id)
	if (promptIndex < 0) return messages
	return [...messages.slice(0, promptIndex + 1), answer, ...messages.slice(promptIndex + 1)]
}
