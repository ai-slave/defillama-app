import type { Writable } from 'node:stream'

export function isoDateFromTimestamp(timestamp: number): string {
	return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

export async function writeCsvChunk(output: Writable, chunk: string): Promise<void> {
	if (output.destroyed || output.writableEnded) throw new Error('CSV output stream is closed')
	if (output.write(chunk)) return
	await new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			output.off('drain', handleDrain)
			output.off('error', handleError)
			output.off('close', handleClose)
		}
		const handleDrain = () => {
			cleanup()
			resolve()
		}
		const handleError = (error: Error) => {
			cleanup()
			reject(error)
		}
		const handleClose = () => {
			cleanup()
			reject(new Error('CSV output stream closed before draining'))
		}
		output.once('drain', handleDrain)
		output.once('error', handleError)
		output.once('close', handleClose)
	})
}

export function percentageValues(values: Array<number | undefined>): Array<number | undefined> {
	let total = 0
	for (const value of values) {
		if (value !== undefined) total += value
	}
	if (total <= 0) return values.map((value) => (value === undefined ? undefined : 0))
	return values.map((value) => (value === undefined ? undefined : (value / total) * 100))
}

export function disambiguateCsvLabels<T extends { key: string; label: string }>(entities: Array<T>): Array<T> {
	const labelCounts = new Map<string, number>()
	for (const entity of entities) labelCounts.set(entity.label, (labelCounts.get(entity.label) ?? 0) + 1)
	return entities.map((entity) =>
		(labelCounts.get(entity.label) ?? 0) > 1
			? { ...entity, label: `${entity.label} (${entity.key.slice(entity.key.lastIndexOf(':') + 1)})` }
			: entity
	)
}
