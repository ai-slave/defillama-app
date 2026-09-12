import { constructTable, type RowData, type TableFeatures, type TableOptions } from '@tanstack/react-table'
import { storeReactivityBindings } from '@tanstack/table-core/store-reactivity-bindings'

export function constructTestTable<F extends TableFeatures, T extends RowData>(options: TableOptions<F, T>) {
	return constructTable<F, T>({
		...options,
		features: { ...options.features, coreReactivityFeature: storeReactivityBindings() }
	})
}
