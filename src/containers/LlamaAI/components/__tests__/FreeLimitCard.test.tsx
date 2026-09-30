// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test } from 'vitest'
import { FreeLimitCard } from '~/containers/LlamaAI/components/FreeLimitCard'
import { installUmamiSink } from '~/utils/testing/umamiSink'

const track = installUmamiSink()

describe('FreeLimitCard', () => {
	test('reports each time it is shown, so its click rate has a denominator', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		const container = document.createElement('div')
		const root = createRoot(container)

		await act(async () => root.render(<FreeLimitCard offer={{ code: 'FREE_FORM_LIMIT' } as never} />))

		expect(track).toHaveBeenCalledWith('llamaai-free-limit-view', { limit: 'FREE_FORM_LIMIT' })
		await act(async () => root.unmount())
	})
})
