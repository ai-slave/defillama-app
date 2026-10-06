import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'

const PAGER_BUTTON =
	'rounded-md border border-pro-cards-border px-3 py-1 text-xs text-pro-text-secondary transition-colors not-aria-disabled:hover:bg-sl-hover-bg aria-disabled:opacity-40'

/** Prev and Next under an Investors dashboard table. Each disables itself at the page it moves to, so it keeps focus
    while disabled instead of dropping it to the page. */
export function TablePager({
	label,
	canPrevious,
	canNext,
	onPrevious,
	onNext,
	className
}: {
	label: ReactNode
	canPrevious: boolean
	canNext: boolean
	onPrevious: () => void
	onNext: () => void
	/** Placement only: spacing and the separator above the row. */
	className: string
}) {
	return (
		<div className={`flex items-center justify-between gap-2 ${className}`}>
			<span className="text-xs text-pro-text-label tabular-nums">{label}</span>
			<div className="flex gap-1">
				<Ariakit.Button disabled={!canPrevious} accessibleWhenDisabled onClick={onPrevious} className={PAGER_BUTTON}>
					Prev
				</Ariakit.Button>
				<Ariakit.Button disabled={!canNext} accessibleWhenDisabled onClick={onNext} className={PAGER_BUTTON}>
					Next
				</Ariakit.Button>
			</div>
		</div>
	)
}
