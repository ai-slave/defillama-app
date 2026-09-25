import { expect, test } from 'vitest'
import { needsVerificationBeforeCheckout } from '../Crypto'

test.each([
	{ user: { verified: false, walletAddress: '0x1234' }, blocked: false },
	{ user: { verified: true, walletAddress: undefined }, blocked: false },
	{ user: { verified: false, walletAddress: undefined }, blocked: true },
	{ user: null, blocked: true }
])('checkout asks for verification first: $blocked for $user', ({ user, blocked }) => {
	expect(needsVerificationBeforeCheckout(user)).toBe(blocked)
})
