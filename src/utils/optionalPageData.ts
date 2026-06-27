import { recordRuntimeError } from './telemetry'

export function recordOptionalPageDataFailure(label: string, error: unknown): void {
	recordRuntimeError(error, 'pageBuild', { optional: true, label })
	const message = error instanceof Error ? error.message : String(error)
	console.warn(`[optional-page-data] ${label} failed: ${message}`)
}

export async function optionalPageData<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await run()
	} catch (error) {
		recordOptionalPageDataFailure(label, error)
		return fallback
	}
}
