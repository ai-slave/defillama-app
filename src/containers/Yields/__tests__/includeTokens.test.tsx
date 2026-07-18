import type { Dispatch, SetStateAction } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IncludeTokens } from '../Filters/IncludeTokens'
import type { MatchConfig } from '../Filters/TokenSearchDialog'

interface DialogProps {
	selectedValues: string[]
	onToggle: (value: string, wasSelected: boolean) => void
	onClear: () => void
	match?: MatchConfig
}

const mocks = vi.hoisted(() => ({
	router: {
		query: {} as Record<string, string | string[] | undefined>
	},
	pushYieldsQuery: vi.fn(),
	dialogProps: undefined as DialogProps | undefined,
	state: {
		cursor: 0,
		values: [] as unknown[]
	}
}))

vi.mock('react', async (importOriginal) => {
	const react = await importOriginal<typeof import('react')>()
	return {
		...react,
		useState: <T,>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] => {
			const index = mocks.state.cursor++
			if (!(index in mocks.state.values)) {
				mocks.state.values[index] = typeof initial === 'function' ? (initial as () => T)() : initial
			}
			const setValue: Dispatch<SetStateAction<T>> = (next) => {
				const previous = mocks.state.values[index] as T
				mocks.state.values[index] = typeof next === 'function' ? (next as (value: T) => T)(previous) : next
			}
			return [mocks.state.values[index] as T, setValue]
		}
	}
})

vi.mock('next/router', () => ({
	useRouter: () => mocks.router
}))

vi.mock('../queryUpdates.client', () => ({
	pushYieldsQuery: mocks.pushYieldsQuery
}))

vi.mock('../Filters/TokenSearchDialog', () => ({
	TokenSearchDialog: (props: DialogProps) => {
		mocks.dialogProps = props
		return null
	}
}))

vi.mock('~/ui/Icon', () => ({ Icon: () => null }))
vi.mock('~/utils/analytics/yields', () => ({
	YIELDS_EVENTS: {
		SEARCH_TOKEN_INCLUDE: 'search_token_include',
		SEARCH_TOKEN_MATCH: 'search_token_match',
		SEARCH_TOKEN_ON: 'search_token_on'
	},
	trackYieldsEvent: vi.fn()
}))

function renderFilter() {
	mocks.state.cursor = 0
	mocks.dialogProps = undefined
	renderToStaticMarkup(<IncludeTokens tokens={[['Ethereum', 'ETH']]} matchOn />)
	return mocks.dialogProps!
}

describe('IncludeTokens match configuration', () => {
	beforeEach(() => {
		mocks.router.query = {}
		mocks.pushYieldsQuery.mockReset()
		// Keep the dialog open while rendering without a browser interaction harness.
		mocks.state.values = [true]
	})

	it('keeps dormant settings local and commits both with the first token', () => {
		let dialog = renderFilter()

		dialog.match!.onModeChange('contains')
		dialog = renderFilter()
		dialog.match!.onOnChange('pool')
		dialog = renderFilter()

		expect(mocks.pushYieldsQuery).not.toHaveBeenCalled()

		dialog.onToggle('ETH', false)

		expect(mocks.pushYieldsQuery).toHaveBeenCalledWith(mocks.router, {
			token: ['ETH'],
			tokenMatch: 'contains',
			tokenOn: 'pool'
		})
	})

	it('updates active settings immediately and clears their URL state with the last token', () => {
		mocks.router.query = { token: 'ETH', tokenMatch: 'contains', tokenOn: 'pool' }
		let dialog = renderFilter()

		dialog.match!.onModeChange('set')
		expect(mocks.pushYieldsQuery).toHaveBeenLastCalledWith(mocks.router, { tokenMatch: 'set' })

		dialog = renderFilter()
		dialog.match!.onOnChange('both')
		expect(mocks.pushYieldsQuery).toHaveBeenLastCalledWith(mocks.router, { tokenOn: 'both' })

		dialog = renderFilter()
		dialog.onToggle('ETH', true)
		expect(mocks.pushYieldsQuery).toHaveBeenLastCalledWith(mocks.router, {
			token: [],
			tokenMatch: undefined,
			tokenOn: undefined
		})

		mocks.router.query = {}
		dialog = renderFilter()
		expect(dialog.match).toMatchObject({ mode: 'set', on: 'both' })
	})
})
