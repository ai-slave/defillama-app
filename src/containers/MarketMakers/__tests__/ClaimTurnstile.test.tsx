import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ClaimTurnstile, isClaimTurnstileEnabled } from '../ClaimTurnstile'

vi.mock('@marsidev/react-turnstile', () => ({
	Turnstile: ({ siteKey, options }: { siteKey: string; options: { action: string; theme: string } }) => (
		<div data-site-key={siteKey} data-action={options.action} data-theme={options.theme} />
	)
}))

vi.mock('~/contexts/LocalStorage', () => ({
	useDarkModeManager: () => [false]
}))

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('ClaimTurnstile', () => {
	test('uses the separate claim widget and claim action', () => {
		vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', 'claim-site-key')

		expect(isClaimTurnstileEnabled()).toBe(true)
		const html = renderToStaticMarkup(<ClaimTurnstile onVerify={() => undefined} onError={() => undefined} />)

		expect(html).toContain('data-site-key="claim-site-key"')
		expect(html).toContain('data-action="claim"')
		expect(html).toContain('data-theme="light"')
	})

	test('renders nothing when the client site key is not configured', () => {
		vi.stubEnv('NEXT_PUBLIC_CLAIMS_TURNSTILE_SITE_KEY', '')

		const html = renderToStaticMarkup(<ClaimTurnstile onVerify={() => undefined} onError={() => undefined} />)

		expect(isClaimTurnstileEnabled()).toBe(false)
		expect(html).toBe('')
	})
})
