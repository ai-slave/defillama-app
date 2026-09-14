import { afterEach, expect, test, vi } from 'vitest'
import { isMacPlatform } from '../platform'

function stubNavigator(platform: string, userAgent: string) {
	vi.stubGlobal('navigator', { platform, userAgent })
}

afterEach(() => {
	vi.unstubAllGlobals()
})

test('reads a mac from the platform string', () => {
	stubNavigator('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
	expect(isMacPlatform()).toBe(true)
})

test('reads a mac from the user agent when the platform is empty', () => {
	stubNavigator('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
	expect(isMacPlatform()).toBe(true)
})

test('answers false for other platforms', () => {
	stubNavigator('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
	expect(isMacPlatform()).toBe(false)
	stubNavigator('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')
	expect(isMacPlatform()).toBe(false)
})

test('answers false when there is no navigator', () => {
	vi.stubGlobal('navigator', undefined)
	expect(isMacPlatform()).toBe(false)
})
