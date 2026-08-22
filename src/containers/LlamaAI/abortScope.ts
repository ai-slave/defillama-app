import type { ExecutionOperation } from '~/containers/LlamaAI/executionCoordinator'

export class AbortScope {
	private nextId = 0
	private current: { controller: AbortController; id: number } | null = null

	run<Result>(sessionId: string | null, execute: (operation: ExecutionOperation) => Promise<Result>): Promise<Result> {
		this.invalidate()
		const record = { controller: new AbortController(), id: ++this.nextId }
		const operation: ExecutionOperation = {
			id: record.id,
			sessionId,
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
		return result.finally(() => {
			if (this.current === record) this.current = null
		})
	}

	invalidate(): void {
		const record = this.current
		if (!record) return
		this.current = null
		record.controller.abort()
	}
}
