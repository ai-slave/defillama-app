import { describe, expect, it } from 'vitest'
import type { AuthModel } from '~/utils/pocketbase'
import { hasUtrAccess, resolveGateState, UTR_REDIRECT_PATH } from '../AccessGate'

const user = (flags: AuthModel['flags'] = {}, id = 'viewer-id') =>
	({
		id,
		flags
	}) as AuthModel

describe('utr access helpers', () => {
	it('redirects denied access to the home page', () => {
		expect(UTR_REDIRECT_PATH).toBe('/')
	})

	it('grants access when is_llama or forgd_preview is exactly true', () => {
		expect(hasUtrAccess(null)).toBe(false)
		expect(hasUtrAccess(undefined)).toBe(false)
		expect(hasUtrAccess(user({}))).toBe(false)
		expect(hasUtrAccess(user({ forgd_preview: false }))).toBe(false)
		expect(hasUtrAccess(user({ forgd_preview: 1 }))).toBe(false)
		expect(hasUtrAccess(user({ is_llama: 1 }))).toBe(false)
		expect(hasUtrAccess(user({ forgd_preview: true }))).toBe(true)
		expect(hasUtrAccess(user({ is_llama: true }))).toBe(true)
		expect(hasUtrAccess(user({ is_llama: true, forgd_preview: true }))).toBe(true)
	})
})

describe('resolveGateState', () => {
	it('stays loading until the client mounts and flags resolve', () => {
		expect(resolveGateState({ isClient: false, isLoading: false, hasAccess: true })).toBe('loading')
		expect(resolveGateState({ isClient: true, isLoading: true, hasAccess: true })).toBe('loading')
	})

	it('authorizes with access and redirects without it once resolved', () => {
		expect(resolveGateState({ isClient: true, isLoading: false, hasAccess: true })).toBe('authorized')
		expect(resolveGateState({ isClient: true, isLoading: false, hasAccess: false })).toBe('redirect')
	})
})
