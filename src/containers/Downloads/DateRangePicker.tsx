import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import { useId, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { type DateRangeConfig, type DateRangePreset, formatDateRangeLong } from './savedDownloads'

const PRESET_LABELS: Array<{ label: string; preset: DateRangePreset }> = [
	{ label: '7D', preset: '7d' },
	{ label: '30D', preset: '30d' },
	{ label: '90D', preset: '90d' },
	{ label: '1Y', preset: '1y' },
	{ label: 'YTD', preset: 'ytd' },
	{ label: 'All', preset: 'all' }
]

interface DateRangePickerProps {
	value: DateRangeConfig | null
	onChange: (value: DateRangeConfig | null) => void
	minDate?: string
	maxDate?: string
	disabled?: boolean
}

export function DateRangePicker({ value, onChange, minDate, maxDate, disabled }: DateRangePickerProps) {
	const id = useId()
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })
	const today = dayjs().format('YYYY-MM-DD')
	const maxAllowed = maxDate ?? today

	// Local state for custom inputs — commits to onChange only on Apply, so
	// half-typed dates don't clobber the active preset mid-edit.
	const [customFrom, setCustomFrom] = useState<string>(value?.kind === 'custom' ? value.from : '')
	const [customTo, setCustomTo] = useState<string>(value?.kind === 'custom' ? value.to : '')
	const [error, setError] = useState<string | null>(null)

	// The custom inputs restart from the selected range whenever the selection changes.
	const [syncedValue, setSyncedValue] = useState(value)
	if (value !== syncedValue) {
		setSyncedValue(value)
		setCustomFrom(value?.kind === 'custom' ? value.from : '')
		setCustomTo(value?.kind === 'custom' ? value.to : '')
		setError(null)
	}

	const activePreset: DateRangePreset | null = value?.kind === 'preset' ? value.preset : null
	// "All" reads as "selected" when there is no filter — zero-state is literally "all time".
	const isAllSelected = !value || activePreset === 'all'
	const isActive = !!value && !(value.kind === 'preset' && value.preset === 'all')

	const handlePresetClick = (preset: DateRangePreset) => {
		setCustomFrom('')
		setCustomTo('')
		setError(null)
		if (preset === 'all') {
			onChange(null)
		} else {
			onChange({ kind: 'preset', preset })
		}
		popover.hide()
	}

	const handleClear = () => {
		setCustomFrom('')
		setCustomTo('')
		setError(null)
		popover.getState().disclosureElement?.focus()
		onChange(null)
		popover.hide()
	}

	const triggerLabel = isActive && value ? formatDateRangeLong(value) : 'Date range'

	const triggerClass = isActive
		? 'flex items-center gap-1.5 rounded-md rounded-r-none border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/15 disabled:opacity-40'
		: 'flex items-center gap-1.5 rounded-md border border-subtle px-2.5 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary disabled:opacity-40'

	return (
		<Ariakit.PopoverProvider store={popover}>
			<div className="inline-flex items-stretch">
				<Ariakit.PopoverDisclosure disabled={disabled} className={triggerClass}>
					<Icon name="calendar" className="size-3.5" />
					<span className="max-w-[160px] truncate">{triggerLabel}</span>
					<Icon name="chevron-down" className="size-3" />
				</Ariakit.PopoverDisclosure>
				{isActive ? (
					<button
						type="button"
						onClick={handleClear}
						disabled={disabled}
						aria-label="Clear date range"
						title="Clear date range"
						className="-ml-px flex items-center justify-center rounded-md rounded-l-none border border-brand/40 bg-brand/10 px-1.5 text-brand transition-colors hover:bg-brand/20 disabled:opacity-40"
					>
						<Icon name="x" className="size-3" />
					</button>
				) : null}
			</div>

			<Ariakit.Popover
				aria-label="Date range"
				gutter={6}
				portal
				unmountOnHide
				className="z-[60] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-medium bg-surface-elevated-1 p-4 shadow-xl"
			>
				<section className="flex flex-col gap-2">
					<h3 className="text-[11px] font-semibold tracking-wide text-pro-text-tertiary uppercase">Quick ranges</h3>
					<div className="flex flex-wrap gap-1">
						{PRESET_LABELS.map(({ label, preset }) => {
							const isSelected = preset === 'all' ? isAllSelected : activePreset === preset
							return (
								<button
									key={preset}
									type="button"
									onClick={() => handlePresetClick(preset)}
									aria-pressed={isSelected}
									className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
										isSelected
											? 'border-brand bg-brand text-on-brand'
											: 'border-subtle text-pro-text-secondary hover:bg-hover-row hover:text-pro-text-primary'
									}`}
								>
									{label}
								</button>
							)
						})}
					</div>
				</section>

				<div className="border-t border-subtle" />

				<form
					onSubmit={(e) => {
						e.preventDefault()
						if (!customFrom || !customTo) {
							setError('Please pick both dates')
							return
						}
						if (customFrom > customTo) {
							setError('"From" must be before or equal to "To"')
							return
						}
						setError(null)
						onChange({ kind: 'custom', from: customFrom, to: customTo })
						popover.hide()
					}}
					className="flex flex-col gap-2"
				>
					<h3 className="text-[11px] font-semibold tracking-wide text-pro-text-tertiary uppercase">Custom range</h3>
					<div className="grid grid-cols-2 gap-2">
						<label className="flex flex-col gap-1">
							<span className="text-[11px] text-pro-text-secondary">From</span>
							<input
								type="date"
								aria-invalid={!!error}
								aria-describedby={error ? `${id}-error` : undefined}
								value={customFrom}
								onChange={(e) => {
									setCustomFrom(e.currentTarget.value)
									setError(null)
								}}
								min={minDate}
								max={customTo || maxAllowed}
								className="min-w-0 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs outline-hidden focus:border-brand focus:ring-1 focus:ring-brand/30"
							/>
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-[11px] text-pro-text-secondary">To</span>
							<input
								type="date"
								aria-invalid={!!error}
								aria-describedby={error ? `${id}-error` : undefined}
								value={customTo}
								onChange={(e) => {
									setCustomTo(e.currentTarget.value)
									setError(null)
								}}
								min={customFrom || minDate}
								max={maxAllowed}
								className="min-w-0 rounded-md border border-subtle bg-transparent px-2 py-1 text-xs outline-hidden focus:border-brand focus:ring-1 focus:ring-brand/30"
							/>
						</label>
					</div>
					{error ? (
						<p id={`${id}-error`} role="alert" className="text-[11px] text-error">
							{error}
						</p>
					) : null}
					<div className="flex justify-end gap-1.5 pt-1">
						<button
							type="button"
							onClick={handleClear}
							className="rounded-md border border-subtle px-2.5 py-1 text-xs font-medium text-pro-text-secondary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
						>
							Clear
						</button>
						<button
							type="submit"
							disabled={!customFrom || !customTo}
							className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-on-brand transition-colors hover:opacity-90 disabled:opacity-40"
						>
							Apply
						</button>
					</div>
				</form>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
