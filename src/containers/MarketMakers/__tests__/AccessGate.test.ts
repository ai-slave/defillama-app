import { describe, expect, it } from 'vitest'
import type { AuthModel } from '~/utils/pocketbase'
import { FORGD_PREVIEW_REDIRECT_PATH, hasForgdPreview, resolveGateState } from '../AccessGate'

const user = (flags: AuthModel['flags'] = {}, id = 'viewer-id') =>
	({
		id,
		flags
	}) as AuthModel

describe('forgd preview access helpers', () => {
	it('redirects denied access to the home page', () => {
		expect(FORGD_PREVIEW_REDIRECT_PATH).toBe('/')
	})

	it('grants access only when forgd_preview is exactly true', () => {
		expect(hasForgdPreview(null)).toBe(false)
		expect(hasForgdPreview(undefined)).toBe(false)
		expect(hasForgdPreview(user({}))).toBe(false)
		expect(hasForgdPreview(user({ forgd_preview: false }))).toBe(false)
		expect(hasForgdPreview(user({ forgd_preview: 1 }))).toBe(false)
		expect(hasForgdPreview(user({ forgd_preview: true }))).toBe(true)
		expect(hasForgdPreview(user({ is_llama: true }))).toBe(true)
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
