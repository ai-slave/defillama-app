import PocketBase, { BaseAuthStore } from 'pocketbase'
import type { AuthRequest } from '~/auth/authRequest'
import { POCKETBASE_URL } from '~/constants'
import type { AuthModel } from '~/utils/pocketbase'

export async function authenticateGithub({ signal, popup }: AuthRequest & { popup: Window }) {
	const client = new PocketBase(POCKETBASE_URL, new BaseAuthStore())
	const requestKey = 'github-sign-in'
	let cancel!: (error: Error) => void
	const canceled = new Promise<never>((_resolve, reject) => {
		cancel = reject
	})
	const abort = () => {
		client.cancelRequest(requestKey)
		popup.close()
		cancel(new Error('GitHub sign-in was canceled.'))
	}
	signal.addEventListener('abort', abort, { once: true })
	const closed = window.setInterval(() => {
		if (popup.closed) abort()
	}, 300)
	try {
		if (signal.aborted || popup.closed) throw new Error('GitHub sign-in was canceled.')
		return await Promise.race([
			client.collection<AuthModel>('users').authWithOAuth2({
				provider: 'github',
				requestKey,
				urlCallback: (url) => {
					if (signal.aborted || popup.closed) throw new Error('GitHub sign-in was canceled.')
					popup.location.href = url
				}
			}),
			canceled
		])
	} finally {
		window.clearInterval(closed)
		signal.removeEventListener('abort', abort)
		client.cancelRequest(requestKey)
		popup.close()
	}
}
