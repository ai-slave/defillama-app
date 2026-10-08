import { useMemo, type ComponentProps } from 'react'
import type { UnifiedRowHeaderType } from '~/containers/ProDashboard/unifiedTable/config/types'
import { Icon } from '~/ui/Icon'

type IconName = ComponentProps<typeof Icon>['name']

const PROTOCOL_ROW_HEADER_ORDER: Array<UnifiedRowHeaderType> = ['chain', 'category', 'parent-protocol']

const GROUPING_ICON_BY_KEY: Partial<Record<UnifiedRowHeaderType, IconName>> = {
	chain: 'chain',
	category: 'tag',
	'parent-protocol': 'protocol'
}

const formatGroupingLabel = (header: UnifiedRowHeaderType) => {
	if (header === 'parent-protocol') {
		return 'Protocol'
	}

	return header
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

const GROUPING_OPTIONS = PROTOCOL_ROW_HEADER_ORDER.map((header) => ({
	value: header,
	label: formatGroupingLabel(header),
	icon: GROUPING_ICON_BY_KEY[header],
	description:
		header === 'chain'
			? 'Group rows by blockchain ecosystem.'
			: header === 'category'
				? 'Break protocols down by sector classification.'
				: 'Combine child protocols under their parent project.'
}))

interface GroupingOptionsProps {
	rowHeaders: Array<UnifiedRowHeaderType>
	onToggleRowHeader: (header: UnifiedRowHeaderType) => void
}

export function GroupingOptions({ rowHeaders, onToggleRowHeader }: GroupingOptionsProps) {
	const groupingSummary = useMemo(() => {
		const labels = rowHeaders.length > 0 ? rowHeaders : PROTOCOL_ROW_HEADER_ORDER

		return labels.map((header) => formatGroupingLabel(header)).join(' → ')
	}, [rowHeaders])

	return (
		<>
			<div className="rounded-md border border-pro-cards-border/70 px-2.5 py-1.5 body-sm text-pro-text-tertiary">
				<strong className="text-pro-text-secondary">Grouping:</strong> {groupingSummary}
			</div>
			<div className="grid gap-2 border-t border-pro-cards-border/70 pt-2 sm:grid-cols-2">
				{GROUPING_OPTIONS.map((option) => {
					const active = rowHeaders.includes(option.value)
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => onToggleRowHeader(option.value)}
							aria-pressed={active}
							className={`group flex h-full flex-col gap-1 rounded-lg border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
								active
									? 'border-brand bg-brand-tint shadow-brand-soft'
									: 'border-pro-cards-border hover:border-brand hover:bg-brand-faint'
							}`}
						>
							<span className="flex items-center gap-1.5">
								{option.icon ? (
									<Icon
										height={13}
										width={13}
										name={option.icon}
										className={active ? 'text-link' : 'text-pro-text-tertiary'}
									/>
								) : null}
								<span className="title-sm text-pro-text-primary">{option.label}</span>
								{active ? <Icon name="check" height={11} width={11} className="text-link" /> : null}
							</span>
							<p className="body-sm text-pro-text-secondary">{option.description}</p>
						</button>
					)
				})}
			</div>
		</>
	)
}
