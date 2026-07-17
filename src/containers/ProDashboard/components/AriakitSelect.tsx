import { Popover, PopoverDisclosure, usePopoverStore } from '@ariakit/react'
import { useId, useMemo } from 'react'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from './LoadingSpinner'

export interface SelectOption {
	value: string
	label: string
	icon?: string
	disabled?: boolean
}

interface AriakitSelectProps {
	label?: string
	options: SelectOption[]
	selectedValue: string | null
	onChange: (option: SelectOption) => void
	placeholder?: string
	isLoading?: boolean
	className?: string
}

export function AriakitSelect({
	label,
	options,
	selectedValue,
	onChange,
	placeholder = 'Select...',
	isLoading = false,
	className = ''
}: AriakitSelectProps) {
	const popover = usePopoverStore({ placement: 'bottom-start' })
	const disclosureId = useId()

	const selectedLabel = useMemo(() => {
		if (!selectedValue) return placeholder
		const selected = options.find((opt) => opt.value === selectedValue)
		return selected?.label || selectedValue
	}, [selectedValue, options, placeholder])

	return (
		<div className={className}>
			{label ? (
				<label htmlFor={disclosureId} className="mb-1 block text-[11px] font-medium pro-text2">
					{label}
				</label>
			) : null}
			{isLoading ? (
				<div className="flex h-9 items-center justify-center rounded-md border border-pro-form-control-border bg-surface-elevated-1">
					<LoadingSpinner size="sm" />
				</div>
			) : (
				<>
					<PopoverDisclosure
						id={disclosureId}
						store={popover}
						className="flex w-full items-center justify-between rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					>
						<span className={`truncate ${selectedValue ? 'pro-text1' : 'pro-text3'}`}>{selectedLabel}</span>
						<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
					</PopoverDisclosure>
					<Popover
						store={popover}
						modal={false}
						portal={true}
						flip={false}
						gutter={4}
						className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-lg"
						style={{ minWidth: 'var(--popover-anchor-width)', width: 'max-content' }}
					>
						<div className="max-h-[280px] overflow-y-auto overscroll-contain p-1">
							{options.length === 0 ? (
								<p className="px-3 py-2 text-center text-xs pro-text3">No options available.</p>
							) : null}
							{options.map((option) => {
								const isActive = option.value === selectedValue
								return (
									<button
										key={option.value}
										type="button"
										onClick={() => {
											if (!option.disabled) {
												onChange(option)
												popover.setOpen(false)
											}
										}}
										disabled={option.disabled}
										className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
											option.disabled
												? 'cursor-not-allowed pro-text3 opacity-50'
												: isActive
													? 'bg-brand/10 font-semibold text-brand'
													: 'pro-text2'
										}`}
									>
										<div className="flex items-center gap-2">
											{option.icon ? <Icon name={option.icon as any} width={14} height={14} /> : null}
											<span className="truncate">{option.label}</span>
										</div>
										{isActive ? (
											<Icon name="check" width={12} height={12} className="ml-2 shrink-0 text-brand" />
										) : null}
									</button>
								)
							})}
						</div>
					</Popover>
				</>
			)}
		</div>
	)
}
