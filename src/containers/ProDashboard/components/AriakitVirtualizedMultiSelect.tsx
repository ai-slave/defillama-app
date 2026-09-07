import { Popover, PopoverDisclosure, usePopoverStore } from '@ariakit/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useId, useMemo, useRef, useState } from 'react'
import type { MultiSelectOption } from '~/components/Select/types'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from './LoadingSpinner'

interface AriakitVirtualizedMultiSelectProps {
	label: string
	options: ReadonlyArray<MultiSelectOption>
	selectedValues: Array<string>
	onChange: (values: Array<string>) => void
	placeholder?: string
	isLoading?: boolean
	className?: string
	maxSelections?: number
	renderIcon?: (option: MultiSelectOption) => string | null
	onSearchChange?: (value: string) => void
}

type PopoverBodyProps = Pick<
	AriakitVirtualizedMultiSelectProps,
	'options' | 'selectedValues' | 'onChange' | 'maxSelections' | 'renderIcon' | 'onSearchChange'
>

// Only rendered while the popover is open, so the search box, the filtered list and the virtualizer
// are all destroyed on close instead of being reset the next time it opens.
function MultiSelectPopoverBody({
	options,
	selectedValues,
	onChange,
	maxSelections = 100,
	renderIcon,
	onSearchChange
}: PopoverBodyProps) {
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const listRef = useRef<HTMLDivElement | null>(null)

	const filteredOptions = useMemo(() => {
		if (!deferredSearch) return options
		return matchSorter(options, deferredSearch, { keys: ['label', 'value'] })
	}, [options, deferredSearch])

	const virtualizer = useVirtualizer({
		count: filteredOptions.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => 40,
		overscan: 5
	})

	const toggleValue = (value: string) => {
		if (selectedValues.includes(value)) {
			onChange(selectedValues.filter((v) => v !== value))
		} else {
			if (selectedValues.length < maxSelections) {
				onChange([...selectedValues, value])
			}
		}
	}

	const handleSearchChange = (value: string) => {
		setSearch(value)
		virtualizer.measure()
		if (value) {
			virtualizer.scrollToIndex(0, { align: 'start' })
		}
		onSearchChange?.(value)
	}

	const clearAll = () => {
		onChange([])
		handleSearchChange('')
	}

	const isMaxReached = selectedValues.length >= maxSelections

	return (
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
					onChange={(e) => handleSearchChange(e.target.value)}
					placeholder="Search..."
					className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 py-1.5 pr-2.5 pl-7 text-xs transition-colors focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
				/>
			</div>
			<div
				ref={listRef}
				className="max-h-[280px] overflow-y-auto overscroll-contain rounded-md border border-pro-cards-border"
			>
				{filteredOptions.length === 0 ? (
					<p className="px-3 py-2 text-center text-xs text-pro-text-tertiary">No results found.</p>
				) : (
					<div
						key={`virtual-${filteredOptions.length}`}
						style={{
							height: `${virtualizer.getTotalSize()}px`,
							width: '100%',
							position: 'relative'
						}}
					>
						{virtualizer.getVirtualItems().map((virtualRow) => {
							const option = filteredOptions[virtualRow.index]
							if (!option) return null
							const isActive = selectedValues.includes(option.value)
							const isDisabled = option.disabled || (!isActive && isMaxReached)
							const iconUrl = renderIcon ? renderIcon(option) : option.logo
							return (
								<button
									type="button"
									key={option.value}
									onClick={() => {
										if (!isDisabled) {
											toggleValue(option.value)
										}
									}}
									disabled={isDisabled}
									className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
										isDisabled
											? 'cursor-not-allowed text-pro-text-tertiary opacity-50'
											: isActive
												? 'bg-brand/10 font-semibold text-brand'
												: 'text-pro-text-secondary hover:text-pro-text-primary'
									}`}
									style={{
										position: 'absolute',
										top: 0,
										left: '4px',
										width: 'calc(100% - 8px)',
										height: `${virtualRow.size}px`,
										transform: `translateY(${virtualRow.start}px)`
									}}
								>
									<div className={`flex min-w-0 items-center gap-2 ${option.isChild ? 'pl-4' : ''}`}>
										{iconUrl ? (
											<img
												src={iconUrl}
												alt={option.label}
												width={20}
												height={20}
												className={`size-5 shrink-0 rounded-full object-cover ring-1 ring-pro-cards-border ${
													option.isChild ? 'opacity-70' : ''
												}`}
											/>
										) : null}
										<div className="flex min-w-0 flex-col gap-0.5">
											<span className={`truncate ${option.isChild ? 'text-pro-text-secondary' : ''}`}>
												{option.label}
											</span>
											{option.isChild ? (
												<span className="text-[10px] leading-none text-pro-text-tertiary">Child protocol</span>
											) : null}
										</div>
									</div>
									{isActive ? <Icon name="check" width={14} height={14} className="ml-2 shrink-0 text-brand" /> : null}
								</button>
							)
						})}
					</div>
				)}
			</div>
			{selectedValues.length > 0 ? (
				<div className="mt-2 flex items-center justify-between rounded-md border border-pro-cards-border px-2.5 py-2">
					<div className="flex items-center gap-2">
						<div className="flex size-5 items-center justify-center rounded-full bg-brand/15">
							<Icon name="check" width={10} height={10} className="text-brand" />
						</div>
						<span className="text-[11px] font-medium text-pro-text-secondary">{selectedValues.length} selected</span>
					</div>
					<button
						type="button"
						onClick={clearAll}
						className="text-[11px] font-medium text-pro-text-tertiary transition-colors hover:text-brand"
					>
						Clear All
					</button>
				</div>
			) : null}
		</div>
	)
}

export function AriakitVirtualizedMultiSelect({
	label,
	options,
	selectedValues,
	onChange,
	placeholder = 'Select...',
	isLoading = false,
	className = '',
	maxSelections = 100,
	renderIcon,
	onSearchChange
}: AriakitVirtualizedMultiSelectProps) {
	const popover = usePopoverStore({ placement: 'bottom-start' })
	const disclosureId = useId()

	const buttonLabel =
		selectedValues.length === 0
			? placeholder
			: selectedValues.length === 1
				? options.find((opt) => opt.value === selectedValues[0])?.label || selectedValues[0]
				: `${selectedValues.length} selected`

	return (
		<div className={className}>
			<label htmlFor={disclosureId} className="mb-1 block text-[11px] font-medium text-pro-text-secondary">
				{label}
				{selectedValues.length > 0 ? (
					<span className="ml-1 text-xs text-pro-text-tertiary">
						({selectedValues.length}
						{maxSelections < 100 ? `/${maxSelections}` : null})
					</span>
				) : null}
			</label>
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
						<span
							className={`truncate ${selectedValues.length > 0 ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}`}
						>
							{buttonLabel}
						</span>
						<Icon name="chevron-down" width={12} height={12} className="ml-2 shrink-0 opacity-70" />
					</PopoverDisclosure>
					<Popover
						store={popover}
						modal={false}
						portal
						flip={false}
						gutter={4}
						className="z-50 rounded-md border border-pro-cards-border bg-pro-cards-bg shadow-xl"
						style={{ width: 'var(--popover-anchor-width)' }}
						unmountOnHide
					>
						<MultiSelectPopoverBody
							options={options}
							selectedValues={selectedValues}
							onChange={onChange}
							maxSelections={maxSelections}
							renderIcon={renderIcon}
							onSearchChange={onSearchChange}
						/>
					</Popover>
				</>
			)}
		</div>
	)
}
