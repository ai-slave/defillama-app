import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'

export type EnqueueOutcome<T> =
	| { kind: 'ok'; value: T }
	/** The server refused because the queue is at capacity. */
	| { kind: 'queue-full'; maxDepth: number | null }
	/** Anything else, already logged. */
	| { kind: 'error' }

/**
 * Runs a queue submission and classifies its failure.
 *
 * The classification needs optional chaining inside a `catch`, which React Compiler cannot lower — left
 * inside `AgenticChat` it costs the whole component its optimization. Here it is ordinary code.
 */
export async function runEnqueue<T>(enqueue: () => T | Promise<T>): Promise<EnqueueOutcome<T>> {
	try {
		return { kind: 'ok', value: await enqueue() }
	} catch (queueError) {
		const body =
			queueError instanceof LlamaAITransportError
				? (queueError.body as { error?: string; maxDepth?: number } | null)
				: null
		if (body?.error === 'queue_full') return { kind: 'queue-full', maxDepth: body.maxDepth ?? null }
		console.error(
			'[llama-ai] [queue-enqueue] failed:',
			queueError instanceof Error ? queueError.message : String(queueError)
		)
		return { kind: 'error' }
	}
}

/** The browser's timezone, or undefined where `Intl` is unavailable. */
export function resolveTimezone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone
	} catch {
		return undefined
	}
}
