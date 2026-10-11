// Widest-loaded-range tracking shared by the pool page's chart panels and the reference rates
// chart. Ranges are strictly nested (max ⊇ 90d ⊇ 30d), so only the widest loaded model is tracked
// and narrower views slice it locally; the loader runs only for a range wider than what is held,
// and a request id drops stale responses. Safe to slice because every model precomputes its
// per-point series.

import { useEffect, useRef, useState } from 'react'
import type { QueryRetry } from '~/utils/query'
import { rangeCovers } from './poolChartUtils'
import type { PoolHistoryRange } from './types'

export function useWidestHistory<Model>(
	initialRange: PoolHistoryRange,
	initialModel: Model,
	range: PoolHistoryRange,
	// A null build result keeps the current model: the wider window held nothing new to show.
	load: (range: PoolHistoryRange) => Promise<Model | null>,
	/** False while the reader's data tier is unknown; changing to true retries the requested range. */
	enabled = true
): { model: Model; loading: boolean; failedRead: QueryRetry | null } {
	const [widest, setWidest] = useState({ range: initialRange, model: initialModel })
	// Bumped by Try again to rerun the load for the same range.
	const [attempt, setAttempt] = useState(0)
	// The range whose load last failed and the attempt that failed, while the reader still asks for it. A newer
	// attempt means Try again is running: the error stays on screen with its button waiting.
	const [failed, setFailed] = useState<{ range: PoolHistoryRange; attempt: number } | null>(null)
	const reqId = useRef(0)
	// Read at call time through a ref, so callers can pass an inline closure without re-arming
	// the loading effect on every render.
	const loadRef = useRef(load)
	useEffect(() => {
		loadRef.current = load
	})

	// Already covered by the widest loaded range → slice locally, no network. Loading and error are
	// derived from that, so the effect below only starts requests and records their outcome.
	const pending = enabled && !rangeCovers(widest.range, range)
	// A failure lasts only while its range stays pending: coming back to that range retries it, and
	// the retry shows as loading.
	if (failed !== null && (!pending || failed.range !== range)) setFailed(null)

	useEffect(() => {
		if (!pending) return
		const id = ++reqId.current
		loadRef
			.current(range)
			.then((built) => {
				if (id !== reqId.current) return
				// A null build keeps the model but marks the wider window as loaded: it held nothing new.
				setWidest((current) => ({ range, model: built ?? current.model }))
			})
			.catch(() => {
				if (id === reqId.current) setFailed({ range, attempt })
			})
		return () => {
			if (reqId.current === id) reqId.current += 1
		}
	}, [pending, range, attempt])

	const failedRead =
		failed === null ? null : { refetch: () => setAttempt((n) => n + 1), isFetching: failed.attempt !== attempt }
	return { model: widest.model, loading: pending && failed === null, failedRead }
}
