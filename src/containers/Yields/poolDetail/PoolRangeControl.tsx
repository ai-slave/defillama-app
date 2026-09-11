// The pool page's time-range control, rendered in each chart panel's header beside that panel's
// export buttons. Every panel owns its range: the control writes the panel's own URL param (see
// `getPoolRangeQueryKey`), so changing one chart's window leaves the others where they were. The
// component is shared so the option list has one definition rather than one per panel.

import { useRouter } from 'next/router'
import { ChartGroupingSelector, type ChartGroupingOption } from '~/components/ECharts/shared/ChartGroupingSelector'
import { pushShallowQuery } from '~/utils/routerQuery'
import { writeStickyPref } from '../stickyQueryPrefs'
import {
	getPoolRange,
	getPoolRangeQueryKey,
	getRangeQueryValue,
	POOL_CHART_RANGE_PREFS,
	type PoolRangeKind
} from './queryState'
import type { PoolHistoryRange } from './types'

const RANGE_OPTIONS = [
	{ value: '30d', label: '', shortLabel: '30d' },
	{ value: '90d', label: '', shortLabel: '90d' },
	{ value: 'max', label: '', shortLabel: 'Max' }
] as const satisfies ReadonlyArray<ChartGroupingOption<PoolHistoryRange>>

export function PoolRangeControl({ kind }: { kind: PoolRangeKind }) {
	const router = useRouter()
	const key = getPoolRangeQueryKey(kind)
	const range = getPoolRange(router.query, kind)

	return (
		<ChartGroupingSelector
			value={range}
			options={RANGE_OPTIONS}
			onValueChange={(next) => {
				// The two APY charts share one sticky range preference (storage first, see stickyQueryPrefs).
				if (kind === 'supply' || kind === 'borrow')
					writeStickyPref(POOL_CHART_RANGE_PREFS[kind], getRangeQueryValue(next))
				void pushShallowQuery(
					router,
					{
						// Once the borrow control is used, keep its range independent from the legacy
						// supply fallback. `max` therefore stays explicit on this one key.
						[key]: kind === 'borrow' ? next : getRangeQueryValue(next),
						// On the growth chart a new window also clears a pinned deposit day: the two set the
						// same thing (where the line starts), so the newer action wins.
						...(kind === 'growth' ? { growthFrom: undefined } : {})
					},
					router.pathname
				)
			}}
		/>
	)
}
