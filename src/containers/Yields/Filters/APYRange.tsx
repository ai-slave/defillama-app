import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { formatNumber } from '~/utils/numberFormat'
import { readSingleQueryValue } from '~/utils/routerQuery'
import { pushYieldsQuery } from '../queryUpdates.client'

interface IAPYRange {
	nestedMenu?: boolean
	placement?: Ariakit.PopoverStoreProps['placement']
	size?: 'sm' | 'md'
}

export function APYRange({ nestedMenu, placement, size = 'sm' }: IAPYRange) {
	const router = useRouter()

	const handleSubmit = (e) => {
		e.preventDefault()
		const form = e.target
		const minApy = form.min?.value
		const maxApy = form.max?.value

		const eventData: Record<string, number> = {}
		if (minApy) eventData.min = Number(minApy)
		if (maxApy) eventData.max = Number(maxApy)
		let hasEventData = false
		for (const _key in eventData) {
			hasEventData = true
			break
		}
		if (hasEventData) {
			trackYieldsEvent(YIELDS_EVENTS.FILTER_APY_RANGE, eventData)
		}

		void pushYieldsQuery(router, {
			minApy: minApy || undefined,
			maxApy: maxApy || undefined
		})
	}

	const handleClear = () => {
		void pushYieldsQuery(router, { minApy: undefined, maxApy: undefined })
	}

	const minApy = readSingleQueryValue(router.query.minApy)
	const maxApy = readSingleQueryValue(router.query.maxApy)
	const min = typeof minApy === 'string' && minApy !== '' ? Number(minApy) : null
	const max = typeof maxApy === 'string' && maxApy !== '' ? Number(maxApy) : null

	return (
		<FilterBetweenRange
			trigger={
				<>
					{min || max ? (
						<>
							<span>APY: </span>
							<span className="text-link">{`${formatNumber(min) ?? 'min'} - ${formatNumber(max) ?? 'max'}`}</span>
						</>
					) : (
						<span>APY</span>
					)}
				</>
			}
			variant="secondary"
			onSubmit={handleSubmit}
			onClear={handleClear}
			nestedMenu={nestedMenu}
			size={size}
			min={min}
			max={max}
			placement={placement}
		/>
	)
}
