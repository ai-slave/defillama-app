// @vitest-environment happy-dom

import { afterEach, expect, test, vi } from 'vitest'
import { revokeGoogleCredentialSharing } from './GoogleSignInButton'

function installGoogleRevocation(
	revoke: (loginHint: string, callback: (response: { error?: string; successful: boolean }) => void) => void
) {
	window.google = {
		accounts: {
			id: {
				initialize: vi.fn(),
				renderButton: vi.fn(),
				revoke
			}
		}
	}
}

afterEach(() => {
	vi.useRealTimers()
	delete window.google
})

test('revokes Google credential sharing once for the deleted account', async () => {
	const revoke = vi.fn((_loginHint, callback) => callback({ successful: true }))
	installGoogleRevocation(revoke)

	await expect(revokeGoogleCredentialSharing('person@example.com')).resolves.toBeUndefined()

	expect(revoke).toHaveBeenCalledOnce()
	expect(revoke).toHaveBeenCalledWith('person@example.com', expect.any(Function))
})

test('reports the Google revocation response error', async () => {
	installGoogleRevocation((_loginHint, callback) => callback({ error: 'No active Google session', successful: false }))

	await expect(revokeGoogleCredentialSharing('person@example.com')).rejects.toThrow('No active Google session')
})

test('times out when Google never completes credential revocation', async () => {
	vi.useFakeTimers()
	installGoogleRevocation(vi.fn())

	const revocation = expect(revokeGoogleCredentialSharing('person@example.com')).rejects.toThrow(
		'Google credential revocation timed out'
	)
	await vi.advanceTimersByTimeAsync(10_000)

	await revocation
})
