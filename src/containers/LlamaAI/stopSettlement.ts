import { waitForAbortableDelay } from '~/containers/LlamaAI/executionCoordinator'
import { stopAgenticExecution } from '~/containers/LlamaAI/fetchAgenticResponse'
import type { QueueSnapshot } from '~/containers/LlamaAI/queue/protocol'

export type StopSettlement =
	/** The server confirmed the execution is no longer active. */
	| 'stopped'
	/** The request was aborted, or the reader moved to another session. Nothing to report. */
	| 'abandoned'
	/** The server never acknowledged the stop. The reader is still here and should be told. */
	| 'failed'

/**
 * Polls the server until it confirms an execution stopped.
 *
 * This lives outside the component on purpose. It needs `try`/`finally` to release the settlement
 * controller on every exit path, and a `throw` to escape the retry loop, neither of which React
 * Compiler can lower — inside `AgenticChat` they cost the whole component its optimization.
 */
export async function settleStopRequest({
	sessionId,
	signal,
	authorizedFetch,
	isCurrentSession,
	applyQueueSnapshot,
	release
}: {
	sessionId: string
	signal: AbortSignal
	authorizedFetch: typeof fetch
	isCurrentSession: () => boolean
	applyQueueSnapshot: (snapshot: QueueSnapshot) => void
	release: () => void
}): Promise<StopSettlement> {
	let acknowledged = false
	// Sequential by design: each poll asks whether the execution is still running, and the delays are
	// the backoff between asks. There is nothing to run in parallel.
	try {
		while (!signal.aborted && isCurrentSession()) {
			try {
				const result = await stopAgenticExecution(sessionId, authorizedFetch, signal)
				if (!isCurrentSession()) return 'abandoned'
				acknowledged = true
				if (result.active) {
					await waitForAbortableDelay(500, signal)
					continue
				}
				applyQueueSnapshot(result.snapshot)
				return 'stopped'
			} catch (stopError) {
				if (signal.aborted) return 'abandoned'
				// One failure before the server has ever acknowledged the stop is fatal; after that it is
				// worth retrying, because the execution may already be winding down.
				if (!acknowledged) throw stopError
				await waitForAbortableDelay(1000, signal)
			}
		}
		return 'abandoned'
	} catch {
		if (signal.aborted) return 'abandoned'
		return isCurrentSession() ? 'failed' : 'abandoned'
	} finally {
		release()
	}
}
