import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'

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
			<span className="label-sm text-pro-text-label tabular-nums">{label}</span>
			<div className="flex gap-1">
				<Button variant="secondary" size="sm" disabled={!canPrevious} accessibleWhenDisabled onClick={onPrevious}>
					Prev
				</Button>
				<Button variant="secondary" size="sm" disabled={!canNext} accessibleWhenDisabled onClick={onNext}>
					Next
				</Button>
			</div>
		</div>
	)
}
