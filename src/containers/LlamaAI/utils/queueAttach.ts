type QueueItemState = 'pending' | 'editing' | 'firing' | 'not_sent'

export const QUEUE_ATTACH_WAIT_MS = 90_000

export function hasClaimableQueueWork(queue: Array<{ state: QueueItemState }>): boolean {
	for (const item of queue) {
		if (item.state === 'not_sent') continue
		return item.state === 'pending' || item.state === 'firing'
	}
	return false
}
