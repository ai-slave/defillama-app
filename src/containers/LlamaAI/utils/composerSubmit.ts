type ComposerQueueState = 'pending' | 'editing' | 'firing' | 'not_sent'

export function shouldQueuePrompt(isStreaming: boolean, queue: Array<{ state: ComposerQueueState }>) {
	if (isStreaming) return true
	return queue.some((item) => item.state !== 'not_sent')
}
