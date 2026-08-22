import { createStreamBuffer, type StreamBuffer } from '~/containers/LlamaAI/streamState'

type QueueItemState = 'pending' | 'editing' | 'firing' | 'not_sent'

export interface QueueAttachExecution {
	id: string | null
	buffer: StreamBuffer
}

export function prepareQueueAttachExecution(current: QueueAttachExecution | null, id: string | null) {
	if (current?.id === id) return { execution: current, resetStream: false }
	return { execution: { id, buffer: createStreamBuffer() }, resetStream: true }
}

export const QUEUE_ATTACH_WAIT_MS = 90000

export function hasClaimableQueueWork(queue: Array<{ state: QueueItemState }>): boolean {
	for (const item of queue) {
		if (item.state === 'not_sent') continue
		return item.state === 'pending' || item.state === 'firing'
	}
	return false
}

export function queueAttachSnapshotKey(queue: Array<{ id: string; state: string }>): string {
	return queue.map((item) => `${item.id}:${item.state}`).join('|')
}

export function didQueueAttachProgress(
	beforeQueueKey: string,
	afterQueueKey: string,
	lastMessageId: string | null,
	observedMessageId: string | null
): boolean {
	return (
		afterQueueKey !== beforeQueueKey ||
		(lastMessageId !== null && observedMessageId !== null && observedMessageId !== lastMessageId)
	)
}

export function shouldConfirmQueueDrain(sawQueueWork: boolean, queue: Array<{ state: QueueItemState }>): boolean {
	return sawQueueWork && !hasClaimableQueueWork(queue)
}

export function shouldTriggerQueueAttach(
	isStreaming: boolean,
	sessionId: string | null,
	queue: Array<{ state: QueueItemState }>
): boolean {
	return !isStreaming && !!sessionId && hasClaimableQueueWork(queue)
}
