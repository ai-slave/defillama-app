export interface ExecutionOperation {
	readonly id: number
	readonly sessionId: string | null
	readonly signal: AbortSignal
	isCurrent(): boolean
}

export type ExecutionIntent = 'prompt' | 'edit' | 'resume' | 'queue'

type OperationRecord = {
	id: number
	intent: ExecutionIntent
	sessionId: string | null
	controller: AbortController
	promise: Promise<unknown>
}

export class ExecutionCoordinator {
	private nextId = 0
	private epoch = 0
	private current: OperationRecord | null = null

	run<Result>(
		sessionId: string | null,
		intent: ExecutionIntent,
		execute: (operation: ExecutionOperation) => Promise<Result>
	): Promise<Result> {
		this.invalidate()
		return this.start(sessionId, intent, execute)
	}

	private start<Result>(
		sessionId: string | null,
		intent: ExecutionIntent,
		execute: (operation: ExecutionOperation) => Promise<Result>
	): Promise<Result> {
		const record: OperationRecord = {
			id: ++this.nextId,
			intent,
			sessionId,
			controller: new AbortController(),
			promise: Promise.resolve()
		}
		const operation: ExecutionOperation = {
			id: record.id,
			get sessionId() {
				return record.sessionId
			},
			signal: record.controller.signal,
			isCurrent: () => this.current === record && !record.controller.signal.aborted
		}

		this.current = record
		let result: Promise<Result>
		try {
			result = execute(operation)
		} catch (error) {
			result = Promise.reject(error)
		}
		record.promise = result.finally(() => {
			if (this.current === record) this.current = null
		})
		return record.promise as Promise<Result>
	}

	async ensure<Result>(
		sessionId: string,
		intent: ExecutionIntent,
		execute: (operation: ExecutionOperation) => Promise<Result>
	): Promise<Result> {
		const epoch = this.epoch
		while (true) {
			if (epoch !== this.epoch) throw new DOMException('Aborted', 'AbortError')
			const current = this.current
			if (!current) return this.start(sessionId, intent, execute)
			if (current.sessionId !== sessionId) return this.run(sessionId, intent, execute)
			if (current.intent === intent) return current.promise as Promise<Result>
			await current.promise.catch(() => undefined)
		}
	}

	/** What the running operation is for, from the moment it starts until its promise settles. */
	runningIntent(): ExecutionIntent | null {
		return this.current?.intent ?? null
	}

	adoptSession(previousSessionId: string | null, nextSessionId: string): void {
		if (this.current?.sessionId === previousSessionId) this.current.sessionId = nextSessionId
	}

	invalidate(sessionId?: string): void {
		const operation = this.current
		if (operation && sessionId !== undefined && operation.sessionId !== sessionId) return
		this.epoch += 1
		if (!operation) return
		this.current = null
		operation.controller.abort()
	}
}

export function waitForAbortableDelay(delay: number, signal: AbortSignal): Promise<void> {
	if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			globalThis.clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		}
		const timer = globalThis.setTimeout(() => {
			signal.removeEventListener('abort', onAbort)
			resolve()
		}, delay)
		signal.addEventListener('abort', onAbort, { once: true })
	})
}
