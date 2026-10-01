import {
	columnSizingFeature,
	// oxlint-disable-next-line no-restricted-imports -- the wrapped feature below is the one tables use
	columnVisibilityFeature as tanstackColumnVisibilityFeature,
	type TableFeature,
	tableFeatures
} from '@tanstack/react-table'
import { sortedTableFeatures } from './sorting'

/**
 * Column visibility where a column with `enableHiding: false` (the row's identity column) is always visible.
 * TanStack only stops its own toggles from hiding such a column; stored visibility, presets and pickers write
 * the state directly, so a `name: false` from any of them would still hide the name.
 */
export const columnVisibilityFeature: TableFeature = {
	...tanstackColumnVisibilityFeature,
	assignColumnPrototype: (prototype, table) => {
		tanstackColumnVisibilityFeature.assignColumnPrototype!(prototype, table)
		const getIsVisible = prototype.getIsVisible
		prototype.getIsVisible = function (this: { columnDef: { enableHiding?: boolean } }) {
			return this.columnDef.enableHiding === false || getIsVisible.call(this)
		}
	}
}

export const displayTableFeatures = tableFeatures({
	...sortedTableFeatures,
	columnSizingFeature,
	columnVisibilityFeature
})
