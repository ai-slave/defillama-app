import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const auth = vi.hoisted(() => ({
	hasActiveSubscription: true,
	isAuthenticated: true,
	loaders: { userLoading: false, subscriptionInitialCheck: false }
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => auth
}))
vi.mock('~/hooks/useIsClient', () => ({ useIsClient: () => true }))
// The card names the active window; an empty query is the Now default.
const router = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('next/router', () => ({ useRouter: () => router }))

import type { VerifiedBlock } from '../../data/types'
import { MeasuredCard } from '../Measured'
import type { IYieldTableRow } from '../types'
import { EarnApyCell, ExitCell } from '../YieldsCells'

function publicMeasuredRow(): IYieldTableRow {
	return {
		apy: 5,
		apyBase: 5,
		apyReward: null,
		apyRewardRaw: null,
		configID: '79e042b5-e55d-4a4e-b0b0-6661a570470b',
		pool: 'Pool',
		verified: null,
		verifiedLocked: true,
		resolvedApy: { base: 5, reward: null, intrinsic: null, total: 5 },
		rewardTokensSymbols: [],
		intrinsicSourceSymbol: null
	} as IYieldTableRow
}

describe('embedded public yields rows for a subscriber', () => {
	beforeEach(() => {
		auth.hasActiveSubscription = true
		auth.isAuthenticated = true
		auth.loaders.userLoading = false
		auth.loaders.subscriptionInitialCheck = false
	})

	test('does not show a Pro lock or upsell in the APY and Exit cells', () => {
		const row = publicMeasuredRow()
		const apy = renderToStaticMarkup(<EarnApyCell row={row} median={undefined} />)
		const exit = renderToStaticMarkup(<ExitCell row={row} />)

		expect(apy).toContain('5.00%')
		expect(apy).not.toContain('Unlock Verified APY')
		expect(apy).not.toContain('verified APY is available on a Pro subscription')
		expect(exit).toBe('')
	})

	test('does not treat a pending entitlement as a denial', () => {
		auth.hasActiveSubscription = false
		auth.loaders.userLoading = true
		auth.loaders.subscriptionInitialCheck = true
		const row = publicMeasuredRow()

		const apy = renderToStaticMarkup(<EarnApyCell row={row} median={undefined} />)
		const exit = renderToStaticMarkup(<ExitCell row={row} />)

		expect(apy).not.toContain('Unlock Verified APY')
		expect(apy).not.toContain('verified APY is available on a Pro subscription')
		expect(exit).toBe('')
	})

	test('locks both cells after access is denied', () => {
		auth.hasActiveSubscription = false
		auth.isAuthenticated = false
		const row = publicMeasuredRow()

		const apy = renderToStaticMarkup(<EarnApyCell row={row} median={undefined} />)
		const exit = renderToStaticMarkup(<ExitCell row={row} />)

		expect(apy).toContain('verified APY is available on a Pro subscription')
		expect(exit).toContain('•••')
	})
})

describe('exit cell status mark', () => {
	test('labels a depleted lane as having no liquidity', () => {
		const stamp = new Date().toISOString()
		const row = {
			...publicMeasuredRow(),
			verifiedLocked: false,
			verified: {
				apy: { avg_1d: 5, avg_7d: null, avg_30d: null },
				apy_as_of: stamp,
				apy_confidence: 'high',
				exit: { status: 'depleted', eta_seconds: null, fee_bps: null, as_of: stamp },
				exit_liquidity: { amount: '0', usd: 0, as_of: stamp },
				tvl: { amount: '1000000', usd: 1_000_000, as_of: stamp }
			}
		} as IYieldTableRow

		const html = renderToStaticMarkup(<ExitCell row={row} />)

		expect(html).toContain('No liquidity')
	})

	// Whatever the server still calls partial is a real lane, so a sub-1% share stays a warning.
	test('keeps a sub-1% partial share distinct from no liquidity', () => {
		const stamp = new Date().toISOString()
		const row = {
			...publicMeasuredRow(),
			verifiedLocked: false,
			verified: {
				apy: { avg_1d: 5, avg_7d: null, avg_30d: null },
				apy_as_of: stamp,
				apy_confidence: 'high',
				exit: { status: 'partial', eta_seconds: null, fee_bps: null, as_of: stamp },
				exit_liquidity: { amount: '4000', usd: 4000, as_of: stamp },
				tvl: { amount: '1000000', usd: 1_000_000, as_of: stamp }
			}
		} as IYieldTableRow

		const html = renderToStaticMarkup(<ExitCell row={row} />)

		expect(html).toContain('&lt;1%')
		expect(html).not.toContain('No liquidity')
	})
})

describe('measured APY card states', () => {
	test('names a fresh refused substitution and shows its measured base', () => {
		const verified: VerifiedBlock = {
			apy: { avg_1d: 5.68, avg_7d: null, avg_30d: null },
			apy_as_of: new Date().toISOString(),
			apy_confidence: 'high',
			exit: null,
			exit_liquidity: null,
			tvl: null
		}
		const html = renderToStaticMarkup(
			<MeasuredCard
				rows={[{ label: 'Base', provenance: 'verified', value: '5.68%' }]}
				verified={verified}
				measured={false}
				unsubstitutedMeasured
				poolUrl="/yields/pool/id"
			/>
		)

		expect(html).toContain('Verified APY · not included in total')
		expect(html).toContain('Base')
		expect(html).toContain('5.68%')
		expect(html).not.toContain('Measured, no APY')
	})

	test('dates a stale reading by its own stamp rather than by a fresher exit probe', () => {
		const verified: VerifiedBlock = {
			apy: { avg_1d: null, avg_7d: 99.6, avg_30d: null },
			apy_as_of: new Date(Date.now() - 3 * 86_400_000).toISOString(),
			apy_confidence: 'high',
			exit: { status: 'partial', eta_seconds: null, fee_bps: 0, as_of: new Date().toISOString() },
			exit_liquidity: null,
			tvl: null
		}
		const html = renderToStaticMarkup(
			<MeasuredCard rows={[]} verified={verified} measured={false} poolUrl="/yields/pool/id" />
		)

		expect(html).toContain('Verified APY')
		expect(html).toContain('last measured')
		expect(html).not.toContain('exit measured')
		expect(html).not.toContain('Measured, no APY')
	})

	test('says the figure is reported when the pool is measured for exits only', () => {
		const verified: VerifiedBlock = {
			apy: { avg_1d: null, avg_7d: null, avg_30d: null },
			apy_as_of: null,
			apy_confidence: null,
			exit: { status: 'instant', eta_seconds: null, fee_bps: 0, as_of: new Date().toISOString() },
			exit_liquidity: null,
			tvl: null
		}
		const html = renderToStaticMarkup(
			<MeasuredCard rows={[]} verified={verified} measured={false} poolUrl="/yields/pool/id" />
		)

		expect(html).toContain('Verified exit')
		expect(html).toContain('yield is not')
		expect(html).toContain('exit measured')
	})

	test('names the window a young measurement has not reached and dates the reading it has', () => {
		router.query = { apyWindow: 'avg_7d' }
		const verified: VerifiedBlock = {
			apy: { avg_1d: 3.1, avg_7d: null, avg_30d: null },
			apy_as_of: new Date().toISOString(),
			apy_confidence: 'high',
			exit: { status: 'instant', eta_seconds: null, fee_bps: 0, as_of: new Date().toISOString() },
			exit_liquidity: null,
			tvl: null
		}
		const html = renderToStaticMarkup(
			<MeasuredCard rows={[]} verified={verified} measured={false} poolUrl="/yields/pool/id" />
		)

		expect(html).toContain('Verified APY')
		expect(html).toContain('No 7d measurement yet')
		expect(html).toContain('>measured')
		expect(html).not.toContain('exit measured')
		router.query = {}
	})
})
