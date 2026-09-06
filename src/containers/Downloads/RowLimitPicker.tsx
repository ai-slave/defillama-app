import * as Ariakit from '@ariakit/react'
import { useState } from 'react'
import { Icon } from '~/ui/Icon'
import { formatNumber } from '~/utils/numberFormat'

const PRESETS = [50, 100, 500, 1000] as const

interface RowLimitPickerProps {
	value: number | null // null = no limit / show all rows
	totalRows: number // used to show "of N" in trigger + validate custom input
	onChange: (value: number | null) => void
	disabled?: boolean
}

export function RowLimitPicker({ value, totalRows, onChange, disabled }: RowLimitPickerProps) {
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })

	const [customInput, setCustomInput] = useState<string>(() =>
		value && !PRESETS.includes(value as (typeof PRESETS)[number]) ? String(value) : ''
	)
	const [error, setError] = useState<string | null>(null)

	// The custom input restarts from the selected limit whenever the selection changes.
	const [syncedValue, setSyncedValue] = useState(value)
	if (value !== syncedValue) {
		setSyncedValue(value)
		setCustomInput(value && !PRESETS.includes(value as (typeof PRESETS)[number]) ? String(value) : '')
		setError(null)
	}

	const isActive = value !== null && value > 0

	const handlePresetClick = (n: number | null) => {
		onChange(n)
		popover.hide()
	}

	const handleClear = () => {
		onChange(null)
		popover.hide()
	}

	const triggerLabel = isActive && value ? `Top ${formatNumber(value)}` : 'Row limit'

	const triggerClass = isActive
		? 'flex items-center gap-1.5 rounded-md rounded-r-none border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/15 disabled:opacity-40'
		: 'flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary disabled:opacity-40'

	return (
		<Ariakit.PopoverProvider store={popover}>
			<div className="inline-flex items-stretch">
				<Ariakit.PopoverDisclosure disabled={disabled} className={triggerClass}>
					<Icon name="layers" className="size-3.5" />
					<span className="truncate">{triggerLabel}</span>
					{isActive && totalRows > 0 ? (
						<span className="text-[10px] text-brand/70">of {formatNumber(totalRows)}</span>
					) : null}
					<Icon name="chevron-down" className="size-3" />
				</Ariakit.PopoverDisclosure>
				{isActive ? (
					<button
						type="button"
						onClick={handleClear}
						disabled={disabled}
						aria-label="Clear row limit"
						title="Clear row limit"
						className="-ml-px flex items-center justify-center rounded-md rounded-l-none border border-brand/40 bg-brand/10 px-1.5 text-brand transition-colors hover:bg-brand/20 disabled:opacity-40"
					>
						<Icon name="x" className="size-3" />
					</button>
				) : null}
			</div>

			<Ariakit.Popover
				gutter={6}
				portal
				unmountOnHide
				className="z-[60] flex w-[260px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-medium bg-surface-elevated-1 p-4 shadow-xl"
			>
				<section className="flex flex-col gap-2">
					<h3 className="text-[11px] font-semibold tracking-wide text-pro-text-tertiary uppercase">Top rows</h3>
					<div className="flex flex-wrap gap-1">
						{PRESETS.map((n) => {
							const isSelected = value === n
							return (
								<button
									key={n}
									type="button"
									onClick={() => handlePresetClick(n)}
									aria-pressed={isSelected}
									className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
										isSelected
											? 'border-brand bg-brand text-on-brand'
											: 'border-subtle text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'
									}`}
								>
									{formatNumber(n)}
								</button>
							)
						})}
						<button
							type="button"
							onClick={() => handlePresetClick(null)}
							aria-pressed={!isActive}
							className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
								!isActive
									? 'border-brand bg-brand text-on-brand'
									: 'border-subtle text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'
							}`}
						>
							All
						</button>
					</div>
				</section>

				<div className="border-t border-subtle" />

				<form
					onSubmit={(e) => {
						e.preventDefault()
						const n = Number.parseInt(customInput, 10)
						if (!Number.isFinite(n) || n <= 0) {
							setError('Enter a positive number')
							return
						}
						setError(null)
						onChange(n)
						popover.hide()
					}}
					className="flex flex-col gap-2"
				>
					<h3 className="text-[11px] font-semibold tracking-wide text-pro-text-tertiary uppercase">Custom</h3>
					<div className="flex items-center gap-2">
						<input
							type="number"
							min={1}
							inputMode="numeric"
							value={customInput}
							onChange={(e) => {
								setCustomInput(e.currentTarget.value)
								setError(null)
							}}
							placeholder="e.g. 250"
							className="flex-1 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs outline-hidden focus:border-brand focus:ring-1 focus:ring-brand/30"
						/>
						<button
							type="submit"
							disabled={!customInput}
							className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-on-brand transition-colors hover:opacity-90 disabled:opacity-40"
						>
							Apply
						</button>
					</div>
					{error ? <p className="text-[11px] text-error">{error}</p> : null}
				</form>

				<p className="text-[11px] text-pro-text-tertiary">Applied after sort — top N by current sort order.</p>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
