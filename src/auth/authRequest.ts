import type { AuthRecord, RecordModel } from 'pocketbase'
import pb from '~/utils/pocketbase'

/** `signal` aborts once the request is no longer wanted, such as when its sign-in dialog hides. */
export type AuthRequest = { signal: AbortSignal; onAuthenticated?: () => void }

// Transport cancellation is insufficient: the server can finish after the sheet closes.
export async function runAuthRequest<T>(
	{ signal }: AuthRequest,
	request: (isCurrent: () => boolean) => Promise<T>,
	accept: (result: T) => void
) {
	const initialToken = pb.authStore.token
	let sessionChanged = false
	const unsubscribe = pb.authStore.onChange((token) => {
		if (token !== initialToken) sessionChanged = true
	})
	const isCurrent = () => !signal.aborted && !sessionChanged
	try {
		if (!isCurrent()) return null
		const result = await request(isCurrent)
		if (!isCurrent()) return null
		unsubscribe()
		accept(result)
		return result
	} catch (error) {
		if (!isCurrent()) return null
		throw error
	} finally {
		unsubscribe()
	}
}

export async function acceptAuthSession<T extends { id: string } & Partial<RecordModel>>(
	request: AuthRequest,
	authenticate: (isCurrent: () => boolean) => Promise<{ token: string; record: T }>,
	onAccepted?: (record: T) => void
) {
	const result = await runAuthRequest(request, authenticate, (result) => {
		onAccepted?.(result.record)
		pb.authStore.save(result.token, result.record as AuthRecord)
		// Finish in this accepted turn: rendering the session can immediately unmount the sheet.
		request.onAuthenticated?.()
	})
	return result?.record ?? null
}
