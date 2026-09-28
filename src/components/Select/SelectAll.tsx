import { popoverMultiSelectCheckStyles } from '~/ui/Popover'
import { SelectCheckIcon } from './SelectCheckIcon'

/** Value of the row that leads a multi-select list; never part of a selection. */
export const SELECT_ALL_VALUE = '__select_all__'

export type SelectAllState = 'all' | 'some' | 'none'

/** How much of `scopeKeys` the selection covers, for the tri-state "Select all" row. */
export function getSelectAllState(
	scopeKeys: ReadonlyArray<string>,
	selectedValues: ReadonlyArray<string>
): SelectAllState {
	const selected = new Set(selectedValues)
	let count = 0
	for (const key of scopeKeys) {
		if (selected.has(key)) count++
	}
	return count === 0 ? 'none' : count === scopeKeys.length ? 'all' : 'some'
}

/** The row's label and tri-state box: checked when all are selected, a dash when some are. */
export function SelectAllContent({ label, state }: { label: string; state: SelectAllState }) {
	return (
		<>
			<span>
				{label}
				<span className="sr-only">
					{state === 'all' ? ', all selected' : state === 'some' ? ', some selected' : ''}
				</span>
			</span>
			<span className={popoverMultiSelectCheckStyles(state !== 'none')} aria-hidden>
				{state === 'all' ? (
					<SelectCheckIcon />
				) : state === 'some' ? (
					<span className="h-0.5 w-2 rounded-full bg-current" />
				) : null}
			</span>
		</>
	)
}
