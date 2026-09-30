import { Popover, PopoverDisclosure, usePopoverStore } from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useId, useMemo, useState } from 'react'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { tw } from '~/ui/tw'

export interface VirtualizedSelectOption {
	value: string
	label: string
	logo?: string
	disabled?: boolean
	isChild?: boolean
	icon?: string
	description?: string
	extra?: string
}

const PRO_TOOLBAR_CHIP_CLASS = tw`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-pro-cards-border bg-pro-cards-bg px-3 text-sm font-medium whitespace-nowrap text-pro-text-primary transition-[color,background-color,border-color,translate,scale] duration-120 ease-out-quart hover:bg-pro-hover-fill active:translate-y-px active:scale-[.985] disabled:active:translate-none disabled:active:scale-none aria-disabled:active:translate-none aria-disabled:active:scale-none`

interface AriakitVirtualizedSelectProps {
	label: string
	variant?: 'field' | 'chip'
	options: Array<VirtualizedSelectOption>
	selectedValue: string | null
	onChange: (option: VirtualizedSelectOption) => void
	placeholder?: string
	isLoading?: boolean
	className?: string
	renderIcon?: (option: VirtualizedSelectOption) => string | null
	placement?: 'top-start' | 'top' | 'top-end' | 'bottom-start' | 'bottom' | 'bottom-end'
}

export function AriakitVirtualizedSelect({
	label,
	options,
	selectedValue,
	onChange,
	placeholder = 'Select...',
	isLoading = false,
	className = '',
	variant = 'field',
	renderIcon,
	placement = 'bottom-start'
}: AriakitVirtualizedSelectProps) {
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	// State, not a ref: the popover portals the list in after this component renders, and the virtualizer picks up a
	// scroll element only on a render after it exists.
	const [listElement, setListElement] = useState<HTMLDivElement | null>(null)
	const disclosureId = useId()

	const filteredOptions = useMemo(() => {
		if (!deferredSearch) return options
		return matchSorter(options, deferredSearch, { keys: ['label', 'value'] })
	}, [options, deferredSearch])

	const virtualizer = useVirtualItems({
		count: filteredOptions.length,
		getScrollElement: () => listElement,
		estimateSize: () => 44,
		overscan: 8
	})

	const { scrollToIndex } = virtualizer
	const popover = usePopoverStore({
		placement,
		// Every open starts at the top. The list stays in the DOM while hidden, and browsers ignore scroll writes to a
		// hidden list, so it returns to the top as it closes, while it is still shown.
		setOpen: (open) => {
			if (!open) scrollToIndex(0, { align: 'start' })
		}
	})

	const selectedOption = options.find((opt) => opt.value === selectedValue)

	const selectedLabel = selectedOption?.label || placeholder

	const handleSelect = (option: VirtualizedSelectOption) => {
		if (!option.disabled) {
			onChange(option)
			popover.setOpen(false)
			setSearch('')
		}
	}

	const isChip = variant === 'chip'
	const chipContent = (
		<>
			{selectedOption?.logo ? (
				<img src={selectedOption.logo} alt="" loading="lazy" className="h-4 w-4 shrink-0 rounded-full" />
			) : selectedOption?.icon ? (
				<span aria-hidden>{selectedOption.icon}</span>
			) : null}
			<span className="text-pro-text-tertiary">{label}</span>
			<span className={`truncate ${selectedOption ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}`}>
				{selectedLabel}
			</span>
		</>
	)

	return (
		<div className={className}>
			<label
				htmlFor={disclosureId}
				className={isChip ? 'sr-only' : 'mb-1 block text-xs font-medium text-pro-text-secondary'}
			>
				{label}
			</label>
			{isLoading ? (
				isChip ? (
					<div className={`${PRO_TOOLBAR_CHIP_CLASS} cursor-default`}>
						<span className="text-pro-text-tertiary">{label}</span>
						<LoadingSpinner size={16} />
					</div>
				) : (
					<div className="flex h-9 items-center justify-center rounded-md border border-pro-cards-border bg-surface-elevated-1">
						<LoadingSpinner size={16} />
					</div>
				)
			) : (
				<>
					<PopoverDisclosure
						id={disclosureId}
						store={popover}
						className={
							isChip
								? PRO_TOOLBAR_CHIP_CLASS
								: 'flex w-full items-center justify-between rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2.5 py-1.5 text-xs transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden'
						}
					>
						{isChip ? (
							chipContent
						) : (
							<span
								className={`flex min-w-0 items-center gap-2 truncate ${selectedOption ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}`}
							>
								{selectedOption?.icon ? (
									<span className="text-sm" aria-hidden>
										{selectedOption.icon}
									</span>
								) : null}
								<span className="truncate">{selectedLabel}</span>
							</span>
						)}
						<Icon
							name="chevron-down"
							width={12}
							height={12}
							className={`shrink-0 opacity-70 ${isChip ? '' : 'ml-2'}`}
						/>
					</PopoverDisclosure>
					<Popover
						store={popover}
						modal={false}
						portal
						flip={false}
						gutter={4}
						className={`z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-overlay-sm ${isChip ? 'w-64' : ''}`}
						style={isChip ? { minWidth: 'var(--popover-anchor-width)' } : { width: 'var(--popover-anchor-width)' }}
					>
						<div className="p-2">
							<div className="relative mb-2">
								<Icon
									name="search"
									width={12}
									height={12}
									className="absolute top-1/2 left-2.5 -translate-y-1/2 text-pro-text-tertiary"
								/>
								<input
									value={search}
									onChange={(e) => {
										setSearch(e.target.value)
										scrollToIndex(0, { align: 'start' })
									}}
									placeholder="Search..."
									className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 text-xs transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
								/>
							</div>
							<div
								ref={setListElement}
								className="max-h-[280px] overflow-y-auto overscroll-contain rounded-md border border-pro-cards-border"
							>
								{filteredOptions.length === 0 ? (
									<p className="px-3 py-2 text-center text-xs text-pro-text-tertiary">No results found.</p>
								) : (
									<div
										className="p-1"
										style={{
											height: virtualizer.totalSize,
											position: 'relative'
										}}
									>
										{virtualizer.items.map((row) => {
											const option = filteredOptions[row.index]
											if (!option) return null
											const isActive = option.value === selectedValue
											const iconUrl = renderIcon ? renderIcon(option) : option.logo
											return (
												<button
													type="button"
													key={option.value}
													onClick={() => handleSelect(option)}
													disabled={option.disabled}
													className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-all ${
														option.disabled
															? 'cursor-not-allowed text-pro-text-tertiary opacity-50'
															: isActive
																? 'bg-brand/10 font-semibold text-brand shadow-sm'
																: 'text-pro-text-secondary hover:text-pro-text-primary'
													}`}
													style={{
														position: 'absolute',
														top: 0,
														left: 0,
														width: '100%',
														transform: `translateY(${row.start}px)`
													}}
												>
													<div className={`flex min-w-0 items-center gap-2.5 ${option.isChild ? 'pl-4' : ''}`}>
														{option.icon ? (
															<span className="text-sm" aria-hidden>
																{option.icon}
															</span>
														) : null}
														{iconUrl ? (
															<img
																src={iconUrl}
																alt={option.label}
																width={20}
																height={20}
																className={`size-5 rounded-full object-cover ring-1 ring-pro-cards-border ${
																	option.isChild ? 'opacity-70' : ''
																}`}
															/>
														) : null}
														<div className="flex min-w-0 flex-col">
															<span className={`truncate ${option.isChild ? 'text-pro-text-secondary' : ''}`}>
																{option.label}
															</span>
															{option.isChild ? (
																<span className="text-xs text-pro-text-tertiary">Child protocol</span>
															) : null}
															{option.description ? (
																<span className="truncate text-xs text-pro-text-tertiary">{option.description}</span>
															) : null}
														</div>
													</div>
													{isActive ? (
														<Icon name="check" width={14} height={14} className="ml-2 shrink-0 text-brand" />
													) : null}
												</button>
											)
										})}
									</div>
								)}
							</div>
						</div>
					</Popover>
				</>
			)}
		</div>
	)
}
