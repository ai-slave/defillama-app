import { useRouter } from 'next/router'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useRangeFilter } from '~/hooks/useRangeFilter'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { nestedMenuActionStyles } from '~/ui/Popover'
import { TagGroup } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'

type FormSubmitHandler = NonNullable<React.ComponentProps<'form'>['onSubmit']>

interface HacksFiltersProps {
	chainOptions: Array<string>
	techniqueOptions: Array<string>
	classificationOptions: Array<string>
	hasActiveFilters: boolean
}

interface FiltersInnerProps {
	chainOptions: Array<string>
	techniqueOptions: Array<string>
	classificationOptions: Array<string>
	timeOptions: Array<TimeLabelKey>
	selectedTimeLabel: TimeLabelKey
	setSelectedTime: (label: TimeLabelKey) => void
	minLostVal: number | null
	maxLostVal: number | null
	handleAmountSubmit: FormSubmitHandler
	handleAmountClear: () => void
	hasActiveFilters: boolean
	onClearAll: () => void
	isMobile?: boolean
}

const TIME_LABEL_TO_KEY = {
	All: 'all',
	'7D': '7d',
	'30D': '30d',
	'90D': '90d',
	'1Y': '1y'
} as const

type TimeLabelKey = keyof typeof TIME_LABEL_TO_KEY
type TimeValueKey = (typeof TIME_LABEL_TO_KEY)[TimeLabelKey]

const defaultTimeOptions: Array<TimeLabelKey> = ['All', '7D', '30D', '90D', '1Y']
function buildKeyToLabel(): Record<TimeValueKey, TimeLabelKey> {
	const result: Partial<Record<TimeValueKey, TimeLabelKey>> = {}
	for (const label of defaultTimeOptions) {
		result[TIME_LABEL_TO_KEY[label]] = label
	}
	return result as Record<TimeValueKey, TimeLabelKey>
}
const keyToLabel = buildKeyToLabel()

export function HacksFilters({
	chainOptions,
	techniqueOptions,
	classificationOptions,
	hasActiveFilters
}: HacksFiltersProps) {
	const router = useRouter()
	const { time } = router.query

	const {
		min: minLostVal,
		max: maxLostVal,
		handleSubmit: handleAmountSubmit,
		handleClear: handleAmountClear
	} = useRangeFilter('minLost', 'maxLost')

	const selectedTimeLabel: TimeLabelKey =
		typeof time === 'string' && time in keyToLabel ? keyToLabel[time as TimeValueKey] : 'All'

	const setSelectedTime = (label: TimeLabelKey): void => {
		const key = TIME_LABEL_TO_KEY[label]
		void pushShallowQuery(router, { time: key && key !== 'all' ? key : undefined })
	}

	const onClearAll = (): void => {
		void pushShallowQuery(router, {
			chain: undefined,
			excludeChain: undefined,
			tech: undefined,
			excludeTech: undefined,
			class: undefined,
			excludeClass: undefined,
			minLost: undefined,
			maxLost: undefined,
			time: undefined
		})
	}

	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap items-center gap-1.5 sm:flex">
				{(nestedMenu) => (
					<Filters
						chainOptions={chainOptions}
						minLostVal={minLostVal}
						maxLostVal={maxLostVal}
						handleAmountSubmit={handleAmountSubmit}
						handleAmountClear={handleAmountClear}
						classificationOptions={classificationOptions}
						techniqueOptions={techniqueOptions}
						timeOptions={defaultTimeOptions}
						selectedTimeLabel={selectedTimeLabel}
						setSelectedTime={setSelectedTime}
						hasActiveFilters={hasActiveFilters}
						onClearAll={onClearAll}
						isMobile={nestedMenu}
					/>
				)}
			</ResponsiveFilterLayout>
		</Card>
	)
}

function Filters({
	chainOptions,
	minLostVal,
	maxLostVal,
	handleAmountSubmit,
	handleAmountClear,
	classificationOptions,
	techniqueOptions,
	timeOptions,
	selectedTimeLabel,
	setSelectedTime,
	hasActiveFilters,
	onClearAll,
	isMobile = false
}: FiltersInnerProps) {
	return (
		<>
			<SelectWithCombobox
				allValues={chainOptions}
				label="Chains"
				labelType="smol"
				variant="filter"
				size="md"
				nestedMenu={isMobile}
				includeQueryKey="chain"
				excludeQueryKey="excludeChain"
			/>
			<FilterBetweenRange
				trigger={
					minLostVal != null || maxLostVal != null ? (
						<>
							<span>Amount: </span>
							<span className="text-link">{`${formatNumber(minLostVal) ?? 'min'} - ${
								formatNumber(maxLostVal) ?? 'max'
							}`}</span>
						</>
					) : (
						'Amount lost'
					)
				}
				min={minLostVal}
				max={maxLostVal}
				onSubmit={handleAmountSubmit}
				onClear={handleAmountClear}
				placement="bottom-start"
				variant="primary"
				size="md"
				nestedMenu={isMobile}
			/>

			<SelectWithCombobox
				allValues={classificationOptions}
				label="Classification"
				labelType="smol"
				variant="filter"
				size="md"
				nestedMenu={isMobile}
				includeQueryKey="class"
				excludeQueryKey="excludeClass"
			/>
			<SelectWithCombobox
				allValues={techniqueOptions}
				label="Techniques"
				labelType="smol"
				variant="filter"
				size="md"
				nestedMenu={isMobile}
				includeQueryKey="tech"
				excludeQueryKey="excludeTech"
			/>

			<div className="px-3 py-2 sm:ml-auto sm:flex-row sm:items-center sm:px-0 sm:py-0">
				<TagGroup
					variant="default"
					size="md"
					setValue={setSelectedTime}
					selectedValue={selectedTimeLabel}
					values={timeOptions}
				/>
			</div>
			{isMobile ? (
				<button type="button" onClick={onClearAll} disabled={!hasActiveFilters} className={nestedMenuActionStyles}>
					Reset filters
				</button>
			) : (
				<Button type="button" size="md" onClick={onClearAll} disabled={!hasActiveFilters}>
					Reset filters
				</Button>
			)}
		</>
	)
}
