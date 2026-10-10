import type * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import type { FormSubmitEvent } from '~/types/forms'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'

type QueryUpdates = Record<string, string | Array<string> | undefined>

export function AvailableRange({
	nestedMenu,
	placement,
	pushQueryUpdates,
	quickPicks
}: {
	nestedMenu?: boolean
	placement?: Ariakit.PopoverStoreProps['placement']
	pushQueryUpdates?: (updates: QueryUpdates) => void
	/** Min chips from `rangeQuickPicks`, counted over the rows the other filters keep. */
	quickPicks: ReadonlyArray<number>
}) {
	const router = useRouter()

	const updateQuery = (updates: QueryUpdates) => {
		if (pushQueryUpdates) {
			pushQueryUpdates(updates)
			return
		}
		void pushShallowQuery(router, updates)
	}

	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		const form = e.currentTarget
		const minAvailable = form.min?.value
		const maxAvailable = form.max?.value

		updateQuery({
			minAvailable: minAvailable || undefined,
			maxAvailable: maxAvailable || undefined
		})
	}

	const minAvailable = readSingleQueryValue(router.query.minAvailable)
	const maxAvailable = readSingleQueryValue(router.query.maxAvailable)

	const handleClear = () => {
		updateQuery({ minAvailable: undefined, maxAvailable: undefined })
	}

	const min = typeof minAvailable === 'string' && minAvailable !== '' ? Number(minAvailable) : null
	const max = typeof maxAvailable === 'string' && maxAvailable !== '' ? Number(maxAvailable) : null

	return (
		<FilterBetweenRange
			heading="Available"
			quickPicks={quickPicks.map((value) => ({ label: formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS), value }))}
			trigger={
				min || max ? (
					<>
						<span>Available: </span>
						<span className="text-link">{`${formatUsd(min, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'min'} - ${formatUsd(max, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'max'}`}</span>
					</>
				) : (
					'Available'
				)
			}
			onSubmit={handleSubmit}
			onClear={handleClear}
			nestedMenu={nestedMenu}
			min={min}
			max={max}
			variant="secondary"
			size="md"
			placement={placement}
		/>
	)
}
