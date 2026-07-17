import { useRouter } from 'next/router'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
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
		const prevSet = new Set(selectedColumns)
		const nextSet = new Set(values)
		for (const value of values) {
			if (!prevSet.has(value)) trackYieldsEvent(YIELDS_EVENTS.FILTER_COLUMN, { column: value, enabled: true })
		}
		for (const value of selectedColumns) {
			if (!nextSet.has(value)) trackYieldsEvent(YIELDS_EVENTS.FILTER_COLUMN, { column: value, enabled: false })
		}
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
