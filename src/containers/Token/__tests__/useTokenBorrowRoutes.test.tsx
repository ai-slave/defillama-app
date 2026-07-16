import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useTokenBorrowRoutes } from '../useTokenBorrowRoutes'

vi.mock('@tanstack/react-query', () => ({
	useQuery: vi.fn(() => ({ data: null, error: null, isLoading: false }))
}))

function Probe({ tokenKeys }: { tokenKeys: string[] }) {
	useTokenBorrowRoutes(tokenKeys)
	return <div>probe</div>
}

describe('useTokenBorrowRoutes', () => {
	it('keys the query by the resolved token option keys with shared cache settings', () => {
		renderToStaticMarkup(<Probe tokenKeys={['family:btc']} />)

		expect(useQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ['token-borrow-routes', 'token-page', 'family:btc'],
				staleTime: 60 * 60 * 1000,
				refetchOnWindowFocus: false,
				retry: false,
				enabled: true
			})
		)
	})

	it('disables the query when no token keys resolve', () => {
		renderToStaticMarkup(<Probe tokenKeys={[]} />)

		expect(useQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				queryKey: ['token-borrow-routes', 'token-page'],
				enabled: false
			})
		)
	})
})
