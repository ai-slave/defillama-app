import * as Ariakit from '@ariakit/react'
import dayjs from 'dayjs'
import { useId, useState, type Ref } from 'react'
import { selectTriggerStyles } from '~/components/Select/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
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
	/** For a control elsewhere that clears the range and hands focus back here. */
	triggerRef?: Ref<HTMLButtonElement>
}

export function DateRangePicker({ value, onChange, minDate, maxDate, disabled, triggerRef }: DateRangePickerProps) {
	const id = useId()
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })
	const today = dayjs().toISOString().slice(0, 10) // the UTC day, as rows are keyed by UTC date
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

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				ref={triggerRef}
				disabled={disabled}
				className={`${selectTriggerStyles('filter', 'md')} max-w-72 shrink-0`}
			>
				<span className="shrink-0">Date range: </span>
				<span className={`truncate ${isActive ? 'text-link' : 'text-tertiary'}`}>
					{isActive && value ? formatDateRangeLong(value) : 'All'}
				</span>
				<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="panel" heading="Date range" className="w-80">
				<div className="flex flex-col gap-3 p-3">
					<section className="flex flex-col gap-2">
						<h3 className="label-sm text-secondary">Quick ranges</h3>
						<div className="flex flex-wrap gap-1">
							{PRESET_LABELS.map(({ label, preset }) => {
								const isSelected = preset === 'all' ? isAllSelected : activePreset === preset
								return (
									<Button
										key={preset}
										type="button"
										variant="toggle"
										size="sm"
										data-active={isSelected}
										aria-pressed={isSelected}
										onClick={() => handlePresetClick(preset)}
									>
										{label}
									</Button>
								)
							})}
						</div>
					</section>

					<form
						onSubmit={(e) => {
							e.preventDefault()
							// Apply stays disabled until both dates are set, which also blocks submitting with Enter.
							if (customFrom > customTo) {
								setError('"From" must be before or equal to "To"')
								return
							}
							setError(null)
							onChange({ kind: 'custom', from: customFrom, to: customTo })
							popover.hide()
						}}
						className="flex flex-col gap-2 border-t border-subtle pt-3"
					>
						<h3 className="label-sm text-secondary">Custom range</h3>
						<div className="grid grid-cols-2 gap-2">
							<label className="flex min-w-0 flex-col gap-1">
								<span className="label-sm text-secondary">From</span>
								<Input
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
									className="w-full min-w-0 cursor-pointer dark:scheme-dark"
								/>
							</label>
							<label className="flex min-w-0 flex-col gap-1">
								<span className="label-sm text-secondary">To</span>
								<Input
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
									className="w-full min-w-0 cursor-pointer dark:scheme-dark"
								/>
							</label>
						</div>
						{error ? (
							<p id={`${id}-error`} role="alert" className="body-sm text-error">
								{error}
							</p>
						) : null}
						<div className="flex justify-end gap-1.5 pt-1">
							<Button type="button" variant="secondary" size="sm" onClick={handleClear}>
								Clear
							</Button>
							<Button type="submit" variant="primary" size="sm" disabled={!customFrom || !customTo}>
								Apply
							</Button>
						</div>
					</form>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
