// @vitest-environment happy-dom

import type { AppProps } from 'next/app'
import { act } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { AUTH_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import type { InvestorsSiteId } from '../config'

// next/script keeps a loaded src in module state for the rest of the file, so later tests would get
// no tag. The stub renders a tag with the attributes the tracker reads and records every website id it was
// rendered with, so a main-site id rendered before the host resolved cannot hide behind a later render.
const { renderedWebsiteIds } = vi.hoisted(() => ({ renderedWebsiteIds: [] as Array<string> }))
vi.mock('next/script', () => ({
	default: ({ onReady: _onReady, strategy: _strategy, ...props }: Record<string, string>) => {
		renderedWebsiteIds.push(props['data-website-id'])
		// A <script> element would be hoisted by React and loaded by happy-dom.
		return <span {...props} />
	}
}))
vi.mock('next/router', () => {
	const events = { on: () => {}, off: () => {} }
	const router = { pathname: '/', asPath: '/', query: {}, events, push: async () => true }
	return { default: router, useRouter: () => router }
})

import App from '~/pages/_app'
import { Logo } from '../Logo'

const PARENT_BRIDGE = 'iframe[src="https://defillama.com/auth-bridge"]'
const session = installSubscriberSession('investor', { account: 'signed-out' })

function app(siteId?: InvestorsSiteId) {
	return (
		<App Component={Logo} pageProps={siteId ? { investorsSiteId: siteId } : {}} router={{} as AppProps['router']} />
	)
}

function trackerScript() {
	const scripts = document.querySelectorAll<HTMLElement>('[src="/script2.js"]')
	expect(scripts).toHaveLength(1)
	return { websiteId: scripts[0].dataset.websiteId, domains: scripts[0].dataset.domains }
}

beforeAll(() => {
	// happy-dom loads iframe pages with its own fetch. Answer the parent's auth bridge page with a blank
	// page that never reports ready, as an unreachable parent would, instead of going to the network.
	const { settings } = (
		window as unknown as {
			happyDOM: { settings: { fetch: { interceptor: { beforeAsyncRequest: () => Promise<Response> } | null } } }
		}
	).happyDOM
	settings.fetch.interceptor = {
		beforeAsyncRequest: async () => new window.Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })
	}
})

describe('request-specific IR rendering and analytics', () => {
	let container: HTMLDivElement
	let root: Root | undefined

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		window.location.href = 'https://defillama.com/'
		sessionStorage.clear()
		renderedWebsiteIds.length = 0
		vi.spyOn(console, 'log').mockImplementation(() => {})
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(async () => {
		if (root) await act(async () => root?.unmount())
		root = undefined
		document.body.innerHTML = ''
		vi.restoreAllMocks()
	})

	test.each([
		['enterprise', 'Enterprise', '1c194e22-d31d-4816-b803-8074419f1b3e'],
		['investors', 'Investor Relations', '11de15eb-61d0-41c5-9e73-0bf496cc653c']
	] as const)('hydrates %s with server-provided branding and its own analytics', async (siteId, brand, websiteId) => {
		window.location.href = `https://${siteId}.defillama.com/`
		const view = app(siteId)
		const errors = vi.fn()
		container.innerHTML = renderToString(view)
		expect(container.textContent).toContain(brand)
		await act(async () => {
			root = hydrateRoot(container, view, { onRecoverableError: errors })
		})
		expect(errors).not.toHaveBeenCalled()
		expect(container.textContent).toContain(brand)
		expect(trackerScript()).toEqual({ websiteId, domains: `${siteId}.defillama.com` })
		// IR sites ask the parent site whether the visitor is signed in.
		expect(document.querySelectorAll(PARENT_BRIDGE)).toHaveLength(1)
	})

	test('an IR host without site props never loads the main-site tracker', async () => {
		window.location.href = 'https://enterprise.defillama.com/404'
		const view = app()
		container.innerHTML = renderToString(view)
		expect(container.querySelector('[data-website-id]')).toBeNull()
		await act(async () => {
			root = hydrateRoot(container, view)
		})
		expect(new Set(renderedWebsiteIds)).toEqual(new Set(['1c194e22-d31d-4816-b803-8074419f1b3e']))
		expect(trackerScript()).toEqual({
			websiteId: '1c194e22-d31d-4816-b803-8074419f1b3e',
			domains: 'enterprise.defillama.com'
		})
		expect(document.querySelectorAll(PARENT_BRIDGE)).toHaveLength(1)
	})

	test('the main site answers IR auth checks for a signed-in visitor and the IR sites do not', async () => {
		// A signed-in visitor's saved settings load too; an empty config keeps them out of the way.
		session.serve({ [`${AUTH_SERVER}/user/config`]: {} })
		pb.authStore.save(session.token, session.record)
		const postMessage = vi.fn()
		const authCheck = () =>
			window.dispatchEvent(
				new MessageEvent('message', {
					origin: 'https://investors.defillama.com',
					data: { type: 'auth-check' },
					source: { postMessage } as unknown as Window
				})
			)
		root = createRoot(container)
		await act(async () => root?.render(app()))
		authCheck()
		expect(postMessage).toHaveBeenCalledWith(
			{ type: 'auth-response', user: { id: 'investor' } },
			{ targetOrigin: 'https://investors.defillama.com' }
		)
		expect(trackerScript()).toEqual({ websiteId: 'ca346731-f7ec-437f-9727-162f29bb67ae', domains: 'defillama.com' })
		// The main site is the parent, so it never opens a bridge to itself.
		expect(document.querySelector(PARENT_BRIDGE)).toBeNull()

		postMessage.mockClear()
		await act(async () => root?.render(app('investors')))
		authCheck()
		await act(async () => root?.render(app('enterprise')))
		authCheck()
		expect(postMessage).not.toHaveBeenCalled()
	})
})
