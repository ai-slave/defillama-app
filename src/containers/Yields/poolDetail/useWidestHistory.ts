// Widest-loaded-range tracking shared by the pool page's chart panels. Ranges are strictly
// nested (max ⊇ 90d ⊇ 30d), so only the widest loaded model is tracked and narrower views slice
// it locally; the loader runs only for a range wider than what is held, and a request id drops
// stale responses. Safe to slice because every model precomputes its per-point series.

import { useEffect, useRef, useState } from 'react'
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
): { model: Model; loading: boolean; error: boolean } {
	const [widest, setWidest] = useState({ range: initialRange, model: initialModel })
	// The range whose load last failed. It reads as an error only while that range is the one asked for.
	const [failed, setFailed] = useState<PoolHistoryRange | null>(null)
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
				if (id === reqId.current) setFailed(range)
			})
		return () => {
			if (reqId.current === id) reqId.current += 1
		}
	}, [pending, range])

	const error = pending && failed === range
	return { model: widest.model, loading: pending && !error, error }
}
