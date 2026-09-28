import type * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import type { FormSubmitEvent } from '~/types/forms'
import { formatNumber } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'

type QueryUpdates = Record<string, string | Array<string> | undefined>

const formatPresetLabel = (value: number) => (value >= 1_000_000 ? `$${value / 1_000_000}M` : `$${value / 1000}k`)

export function TVLRange({
	variant = 'primary',
	size = 'sm',
	nestedMenu,
	placement,
	onValueChange,
	resetPageOnChange,
	pushQueryUpdates,
	label = 'TVL Range',
	minPresets
}: {
	variant?: 'primary' | 'secondary'
	size?: 'sm' | 'md'
	nestedMenu?: boolean
	placement?: Ariakit.PopoverStoreProps['placement']
	onValueChange?: (min: number | null, max: number | null) => void
	resetPageOnChange?: boolean
	pushQueryUpdates?: (updates: QueryUpdates) => void
	label?: string
	minPresets?: ReadonlyArray<number>
}) {
	const router = useRouter()

	const updateQuery = (updates: QueryUpdates) => {
		const payload = resetPageOnChange ? { ...updates, page: undefined } : updates
		if (pushQueryUpdates) {
			pushQueryUpdates(payload)
			return
		}
		void pushShallowQuery(router, payload)
	}

	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		const form = e.currentTarget
		const minTvl = form.min?.value
		const maxTvl = form.max?.value

		onValueChange?.(minTvl ? Number(minTvl) : null, maxTvl ? Number(maxTvl) : null)

		updateQuery({
			minTvl: minTvl || undefined,
			maxTvl: maxTvl || undefined
		})
	}

	const minTvl = readSingleQueryValue(router.query.minTvl)
	const maxTvl = readSingleQueryValue(router.query.maxTvl)

	const handleClear = () => {
		onValueChange?.(null, null)
		updateQuery({
			minTvl: undefined,
			maxTvl: undefined
		})
	}

	const min = typeof minTvl === 'string' && minTvl !== '' ? Number(minTvl) : null
	const max = typeof maxTvl === 'string' && maxTvl !== '' ? Number(maxTvl) : null

	return (
		<FilterBetweenRange
			heading={label}
			{...(minPresets ? { quickPicks: minPresets.map((value) => ({ label: formatPresetLabel(value), value })) } : {})}
			trigger={
				variant === 'secondary' ? (
					<>
						{min || max ? (
							<>
								<span>TVL: </span>
								<span className="text-link">{`${formatNumber(min) ?? 'min'} - ${formatNumber(max) ?? 'max'}`}</span>
							</>
						) : (
							<span>{label}</span>
						)}
					</>
				) : (
					label
				)
			}
			onSubmit={handleSubmit}
			onClear={handleClear}
			variant={variant}
			size={size}
			nestedMenu={nestedMenu}
			min={min}
			max={max}
			placement={placement}
		/>
	)
}
