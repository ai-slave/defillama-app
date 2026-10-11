import { Icon } from '../Icon'

/* The pick mark every selectable row and Checkbox draws, so a pick looks the same in a form, a dialog list, a
   popover and a menu.
   - box: a multi pick. A 14px rounded box, brand-filled with a white check when checked, a brand dash when `mixed`
     (a "Select all" row with some picked), an empty border-strong box when not.
   - tick: a single pick. No box: only the checked row shows a 14px link-colored check; the slot stays in place when
     empty, so labels never shift.
   Always decorative: the row or input carries the checked state for screen readers. `className` is placement only. */

// The disabled colors follow the nearest `group`: a Checkbox label holding a disabled input, or a row or tile that is
// itself disabled (natively or with aria-disabled).
const BOX_STYLES =
	'grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-strong bg-transparent text-transparent data-[checked=true]:border-brand data-[checked=true]:bg-brand data-[checked=true]:text-on-brand group-[:is(:disabled,[aria-disabled=true],:has(:disabled))]:border-disabled group-[:is(:disabled,[aria-disabled=true],:has(:disabled))]:data-[checked=true]:bg-disabled group-[:is(:disabled,[aria-disabled=true],:has(:disabled))]:data-[checked=true]:text-disabled'

export function Check({
	kind,
	checked,
	className
}: {
	kind: 'box' | 'tick'
	checked: boolean | 'mixed'
	className?: string
}) {
	if (kind === 'tick') {
		return (
			<Icon
				name="check"
				aria-hidden
				data-checked={checked !== false}
				className={`size-3.5 shrink-0 text-link ${checked ? '' : 'invisible'} ${className ?? ''}`.trim()}
			/>
		)
	}
	return (
		<span aria-hidden className={`${BOX_STYLES} ${className ?? ''}`.trim()} data-checked={checked !== false}>
			{checked === 'mixed' ? (
				<span className="h-0.5 w-2 rounded-full bg-current" />
			) : checked ? (
				<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 14 14" height="0.875rem" width="0.875rem">
					<polyline points="3,7 5.75,9.75 11,4.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			) : null}
		</span>
	)
}
