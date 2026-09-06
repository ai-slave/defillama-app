import type { QueuedMessageElement } from '~/containers/LlamaAI/queue/protocol'
import type { Message } from '~/containers/LlamaAI/types'

export function materializePersistedUserMessage(
	messages: Array<Message>,
	realId: string,
	queueItemId: string | undefined,
	queuedItem: QueuedMessageElement | null
) {
	if (queueItemId) {
		if (!queuedItem || messages.some((message) => message.id === realId)) return messages
		return [
			...messages,
			{
				role: 'user' as const,
				content: queuedItem.displayMessage ?? queuedItem.message,
				images: queuedItem.images?.length
					? queuedItem.images.map((image) => ({
							url: image.url,
							mimeType: image.mimeType || 'application/octet-stream',
							filename: image.filename
						}))
					: undefined,
				quotedText: queuedItem.quotedText,
				id: realId
			}
		]
	}

	const tail = messages[messages.length - 1]
	if (!tail || tail.role !== 'user' || !tail.id?.startsWith('local-')) return messages
	const next = messages.slice()
	next[next.length - 1] = { ...tail, id: realId }
	return next
}
