import { Popover, PopoverDisclosure, usePopoverStore } from '@ariakit/react'
import { useId, useMemo } from 'react'
import { Icon, type IIcon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

export interface SelectOption<TValue extends string = string> {
	value: TValue
	label: string
	icon?: IIcon['name']
	disabled?: boolean
}

interface AriakitSelectProps<TValue extends string> {
	label?: string
	options: ReadonlyArray<SelectOption<TValue>>
	selectedValue: TValue | null
	onChange: (option: SelectOption<TValue>) => void
	placeholder?: string
	isLoading?: boolean
	className?: string
}

export function AriakitSelect<TValue extends string>({
	label,
	options,
	selectedValue,
	onChange,
	placeholder = 'Select...',
	isLoading = false,
	className = ''
}: AriakitSelectProps<TValue>) {
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
				<label htmlFor={disclosureId} className="mb-1 block text-xs font-medium text-pro-text-secondary">
					{label}
				</label>
			) : null}
			{isLoading ? (
				<div className="flex h-9 items-center justify-center rounded-md border border-pro-cards-border bg-surface-elevated-1">
					<LoadingSpinner size={16} />
				</div>
			) : (
				<>
					<PopoverDisclosure
						id={disclosureId}
						store={popover}
						className="flex w-full items-center justify-between rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					>
						<span className={`truncate ${selectedValue ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}`}>
							{selectedLabel}
						</span>
						<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
					</PopoverDisclosure>
					<Popover
						store={popover}
						modal={false}
						portal
						flip={false}
						gutter={4}
						className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-lg"
						style={{ minWidth: 'var(--popover-anchor-width)', width: 'max-content' }}
					>
						<div className="max-h-[280px] overflow-y-auto overscroll-contain p-1">
							{options.length === 0 ? (
								<p className="px-3 py-2 text-center text-xs text-pro-text-tertiary">No options available.</p>
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
												? 'cursor-not-allowed text-pro-text-tertiary opacity-50'
												: isActive
													? 'bg-brand/10 font-semibold text-brand'
													: 'text-pro-text-secondary'
										}`}
									>
										<div className="flex items-center gap-2">
											{option.icon ? <Icon name={option.icon} width={14} height={14} /> : null}
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
