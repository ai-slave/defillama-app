import type { QueryClient } from '@tanstack/react-query'

const writes = new WeakMap<QueryClient, Map<string, Promise<void>>>()

// The same session can appear in the sidebar and project page. Serialize its edits across those
// owners before applying optimism, so a failed earlier edit cannot become a later rollback value.
export function withSessionWriteScope(client: QueryClient, key: string, write: () => Promise<void>) {
	let pending = writes.get(client)
	if (!pending) {
		pending = new Map()
		writes.set(client, pending)
	}
	const previous = pending.get(key) ?? Promise.resolve()
	const result = previous.then(write)
	const settled = result.then(
		() => {},
		() => {}
	)
	pending.set(key, settled)
	void settled.then(() => {
		if (pending.get(key) === settled) pending.delete(key)
	})
	return result
}
