import { type ReactNode, useState } from 'react'
import type { BlockExplorersResponse } from '~/api/types'
import { Icon } from '~/components/Icon'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { type Tone, toneClasses } from '../kindMeta'
import type { RoleCapability } from '../types'

export const MICRO_LABEL = 'text-xs font-semibold text-(--legacy-text-primary)'

export function explorerUrl(
	address: string,
	chain: string,
	explorers?: BlockExplorersResponse,
	urlType: 'address' | 'token' = 'address'
): string | null {
	const explorer = explorers
		? getBlockExplorerNew({
				apiResponse: explorers,
				address,
				chainName: chain,
				urlType
			})
		: null
	return explorer?.url ?? null
}

export function LabelValueRow({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5">
			<span className="text-sm text-(--legacy-text-secondary)">{label}</span>
			<span className="text-right text-sm text-(--legacy-text-primary)">{children}</span>
		</div>
	)
}

// Depositor-facing reach marker: does this control surface touch your principal, and is
// there a window? Tone follows the gate.
export interface ReachMarker {
	tone: Tone
	label: string
}

export function operatorMarker(cap: RoleCapability | undefined, guardianAbsent: boolean): ReachMarker | null {
	if (guardianAbsent) return { tone: 'danger', label: 'No veto — unguarded' }
	if (!cap) return null
	if (cap.reaches_principal) {
		if (cap.gate === 'instant') return { tone: 'danger', label: 'Reaches deposit · instant' }
		if (cap.gate === 'vault-timelock') return { tone: 'warning', label: 'Reaches deposit · timelocked' }
		return { tone: 'warning', label: 'Reaches deposit' }
	}
	if (cap.gate === 'veto-only') return { tone: 'good', label: 'Safety role · veto only' }
	return { tone: 'good', label: 'No principal access' }
}

export function governanceMarker(reachesPrincipal: boolean | undefined): ReachMarker | null {
	if (reachesPrincipal == null) return null
	return reachesPrincipal
		? { tone: 'warning', label: 'Reaches deposit' }
		: { tone: 'good', label: "Can't touch principal" }
}

// A null marker renders an aligned blank so the addresses stay in their column.
export function ReachDot({ marker }: { marker: ReachMarker | null }) {
	if (!marker) return <span className="size-2 shrink-0" aria-hidden />
	return (
		<span
			role="img"
			aria-label={marker.label}
			title={marker.label}
			className={`size-2 shrink-0 rounded-full ${toneClasses(marker.tone).bar}`}
		/>
	)
}

const REACH_LEGEND: ReadonlyArray<{ tone: Tone; label: string }> = [
	{ tone: 'danger', label: 'Reaches deposit, no delay' },
	{ tone: 'warning', label: 'Reaches deposit, timelocked' },
	{ tone: 'good', label: "Can't reach deposit" }
]

// Paired colour+text so the dots never read as colour-only.
export function ReachLegend() {
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-(--legacy-text-secondary)">
			{REACH_LEGEND.map((item) => (
				<span key={item.label} className="inline-flex items-center gap-1.5">
					<span className={`size-2 shrink-0 rounded-full ${toneClasses(item.tone).bar}`} aria-hidden />
					{item.label}
				</span>
			))}
		</div>
	)
}

// One-line row whose chevron reveals the plain "what this address can do" summary inline
// on click — not hover, so it works on touch and keyboard.
export function ExpandableLine({
	children,
	trailing,
	marker,
	detail
}: {
	children: ReactNode
	trailing?: ReactNode
	marker: ReachMarker | null
	detail?: string
}) {
	const [open, setOpen] = useState(false)
	return (
		<div className="py-2">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				{children}
				<span className="ml-auto flex items-center gap-2.5">
					<ReachDot marker={marker} />
					{trailing}
					{detail ? (
						<button
							type="button"
							onClick={() => setOpen((v) => !v)}
							aria-expanded={open}
							className="-mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded text-(--legacy-text-secondary) hover:bg-(--legacy-bg-secondary) hover:text-(--legacy-text-primary)"
						>
							<Icon name="chevron-down" className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
							<span className="sr-only">{open ? 'Hide detail' : 'Show what this can do'}</span>
						</button>
					) : null}
				</span>
			</div>
			{open && detail ? (
				<p className="mt-1.5 max-w-prose text-xs leading-relaxed text-(--legacy-text-secondary)">{detail}</p>
			) : null}
		</div>
	)
}
