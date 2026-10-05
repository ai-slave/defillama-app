// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import MCPContainer from '..'

const session = installSubscriberSession('mcp-reader', { account: 'signed-out' })

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<MCPContainer />
			</session.Wrapper>
		)
	)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const tab = (name: string) =>
	[...container.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="MCP client"] [role="tab"]')].find(
		(x) => x.textContent === name
	)!
const visiblePanels = () => [...container.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden])')]

test('the client config tabs show one snippet panel, labelled by the selected client, and Codex swaps it in', async () => {
	expect(tab('Claude Code').getAttribute('aria-selected')).toBe('true')
	expect(visiblePanels()).toHaveLength(1)
	expect(visiblePanels()[0].getAttribute('aria-labelledby')).toBe(tab('Claude Code').id)
	expect(visiblePanels()[0].querySelector('pre')!.textContent).toBe(
		'claude mcp add defillama --transport http https://mcp.defillama.com/mcp'
	)

	await act(async () => tab('Codex').click())
	expect(tab('Codex').getAttribute('aria-selected')).toBe('true')
	expect(tab('Claude Code').getAttribute('aria-selected')).toBe('false')
	expect(visiblePanels()).toHaveLength(1)
	expect(visiblePanels()[0].querySelector('pre')!.textContent).toBe(
		'codex mcp add defillama --url https://mcp.defillama.com/mcp'
	)
	expect(visiblePanels()[0].querySelector('button')!.getAttribute('aria-label')).toBe('Copy Codex')
})
