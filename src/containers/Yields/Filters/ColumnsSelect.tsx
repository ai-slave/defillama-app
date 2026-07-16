import { useRouter } from 'next/router'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { pushYieldsQuery } from '../queryUpdates.client'
import { EARN_COLUMN_OPTIONS, EARN_COLUMN_OPTION_KEYS, parseSelectedEarnColumns } from './columnOptions'

export function ColumnsSelect({ nestedMenu }: { nestedMenu?: boolean }) {
	const router = useRouter()
	const { column } = router.query

	const selectedColumns = parseSelectedEarnColumns(
		typeof column === 'string' || Array.isArray(column) ? column : undefined
	)

	// Drive the `column` param directly (state mode): preserve any values owned by other
	// controls/pages, then append the current selection.
	const setSelectedValues = (values: string[]) => {
		const foreign = Array.isArray(column)
			? column.filter((value) => !EARN_COLUMN_OPTION_KEYS.has(value))
			: typeof column === 'string' && !EARN_COLUMN_OPTION_KEYS.has(column)
				? [column]
				: []
		const next = [...foreign, ...values]
		void pushYieldsQuery(router, { column: next.length ? next : undefined })
	}

	return (
		<SelectWithCombobox
			variant="default"
			size="sm"
			allValues={EARN_COLUMN_OPTIONS}
			selectedValues={selectedColumns}
			setSelectedValues={setSelectedValues}
			label="Columns"
			labelType="regular"
			nestedMenu={nestedMenu}
		/>
	)
}
