import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { IProtocolOverviewPageData } from '../types'

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

const renderUserActivity = async (
	users: NonNullable<IProtocolOverviewPageData['users']>,
	gasUsedValueSymbol: string | null = 'POL'
) => {
	const { UserActivity } = await import('../AdditionalInfo')
	return renderToStaticMarkup(<UserActivity users={users} gasUsedValueSymbol={gasUsedValueSymbol} />)
}

const emptyActivity: NonNullable<IProtocolOverviewPageData['users']> = {
	activeUsers: null,
	newUsers: null,
	transactions: null,
	gasUsed: null,
	gasUsedUsd: null
}

describe('UserActivity', () => {
	it('renders native gas usage and USD gas cost as separate metrics', async () => {
		const markup = await renderUserActivity({
			...emptyActivity,
			gasUsed: 398_354,
			gasUsedUsd: 28_520
		})

		expect(markup).toContain('Gas Used (24h)')
		expect(markup).toContain('398,354 POL')
		expect(markup).toContain('Gas Cost (24h)')
		expect(markup).toContain('$28,520')
	})

	it('preserves zero and independent availability for both gas metrics', async () => {
		const nativeOnly = await renderUserActivity({ ...emptyActivity, gasUsed: 0 })
		expect(nativeOnly).toContain('0 POL')
		expect(nativeOnly).not.toContain('Gas Cost (24h)')

		const usdOnly = await renderUserActivity({ ...emptyActivity, gasUsedUsd: 0 })
		expect(usdOnly).not.toContain('Gas Used (24h)')
		expect(usdOnly).toContain('Gas Cost (24h)')
		expect(usdOnly).toContain('$0')
	})
})
