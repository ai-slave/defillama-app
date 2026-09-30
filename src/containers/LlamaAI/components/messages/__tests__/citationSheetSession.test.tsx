// @vitest-environment happy-dom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { useCitationSheetController, type CitationSheetValue } from '../CitationSheetContext'

let root: Root
let sheet: CitationSheetValue
let committed: Array<string | null>

const citation = { url: 'https://example.com/report' } as unknown as UnifiedCitationReference

/** Mirrors the chat: one controller for the whole conversation view, keyed by the open session. */
function Chat({ sessionId }: { sessionId: string | null }) {
	sheet = useCitationSheetController(sessionId)
	useLayoutEffect(() => {
		committed.push(sheet.activeRef ? `${sessionId}:open` : `${sessionId}:closed`)
	})
	return null
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	committed = []
	root = createRoot(document.createElement('div'))
})

afterEach(async () => {
	await act(async () => root.unmount())
})

test('a citation opened in one chat never shows over the next, and coming back does not reopen it', async () => {
	await act(async () => root.render(<Chat sessionId="a" />))
	await act(async () => sheet.open(citation))
	committed = []

	await act(async () => root.render(<Chat sessionId="b" />))
	await act(async () => root.render(<Chat sessionId="a" />))

	expect(committed).toEqual(['b:closed', 'a:closed'])
})
