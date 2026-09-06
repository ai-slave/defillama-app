import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { formatNumber } from '~/utils/numberFormat'

// "Your deposit" — pro-rata scaling happens in the consumers; this only owns the amount.
// Persisted globally (not per pool): your position size is a property of you.

const STORAGE_KEY = 'llama-risk-position-usd'

const PRESETS = [
	{ label: '$1k', value: 1000 },
	{ label: '$10k', value: 10_000 },
	{ label: '$100k', value: 100_000 }
]

// "10000", "10,000", "$10k", "1.5m" → USD. Anything else → null.
export function parseAmount(raw: string): number | null {
	const s = raw
		.trim()
		.toLowerCase()
		.replace(/[$,\s]/g, '')
	if (!s) return null
	const m = s.match(/^(\d+(?:\.\d+)?)([km]?)$/)
	if (!m) return null
	const n = Number(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1)
	return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

type PositionState = [number | null, (v: number | null) => void]

function usePositionUsdState(): PositionState {
	const [position, setPosition] = useState<number | null>(null)

	// Load after mount so SSR and the first client render agree (pool mode).
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY)
			if (raw) {
				const n = Number(raw)
				if (Number.isFinite(n) && n > 0) setPosition(n)
			}
		} catch {
			/* storage unavailable → stay in pool mode */
		}
	}, [])

	const set = useCallback((v: number | null) => {
		setPosition(v)
		try {
			if (v) localStorage.setItem(STORAGE_KEY, String(v))
			else localStorage.removeItem(STORAGE_KEY)
		} catch {
			/* non-persistent is fine */
		}
	}, [])
	// Stable tuple so the context value only changes when the amount does.
	return useMemo<PositionState>(() => [position, set], [position, set])
}

// One amount for the whole section; components rendered outside the provider (tests,
// isolated stories) fall back to their own state and keep working.
const PositionContext = createContext<PositionState | null>(null)

export function PositionProvider({ children }: { children: React.ReactNode }) {
	const state = usePositionUsdState()
	return <PositionContext.Provider value={state}>{children}</PositionContext.Provider>
}

export function usePositionUsd(): PositionState {
	const ctx = useContext(PositionContext)
	const local = usePositionUsdState()
	return ctx ?? local
}

export function PositionControl({
	position,
	onChange
}: {
	position: number | null
	onChange: (v: number | null) => void
}) {
	const [draft, setDraft] = useState('')
	useEffect(() => setDraft(position ? formatNumber(position) : ''), [position])

	const commit = () => {
		const v = parseAmount(draft)
		if (v) onChange(v)
		else {
			onChange(null)
			setDraft('')
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<label htmlFor="risk-position" className="label-sm text-secondary">
				Your deposit <span className="text-tertiary">(optional)</span>
			</label>
			<div className="flex items-center gap-1">
				<div className="relative">
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 left-2 flex items-center body-sm text-secondary"
					>
						$
					</span>
					<Input
						id="risk-position"
						type="text"
						inputMode="decimal"
						autoComplete="off"
						placeholder="amount"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === 'Enter') e.currentTarget.blur()
							if (e.key === 'Escape') setDraft(position ? formatNumber(position) : '')
						}}
						className="w-24 pr-2 pl-5 tabular-nums"
					/>
				</div>
				{position ? (
					<Button
						type="button"
						variant="ghost"
						size="md"
						square
						onClick={() => onChange(null)}
						aria-label="Clear your deposit, show pool-wide figures"
					>
						<Icon name="x" className="size-3" />
					</Button>
				) : null}
			</div>
			<div className="flex items-center gap-1" role="group" aria-label="Deposit presets">
				{PRESETS.map((p) => {
					const active = position === p.value
					return (
						<Button
							key={p.value}
							type="button"
							variant="toggle"
							size="md"
							aria-pressed={active}
							data-active={active}
							onClick={() => onChange(active ? null : p.value)}
						>
							{p.label}
						</Button>
					)
				})}
			</div>
		</div>
	)
}
