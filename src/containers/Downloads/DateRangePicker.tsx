import * as Ariakit from '@ariakit/react'
import { useState, type Ref } from 'react'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { Button } from '~/ui/Button'
import { PopoverSelectTrigger } from '~/ui/ComboboxSelectTrigger'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { formatDate } from '~/utils/dateFormat'
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
	const popover = Ariakit.usePopoverStore({ placement: 'bottom-start' })
	const nowSec = useNowSeconds()
	const today = new Date(nowSec * 1000).toISOString().slice(0, 10) // the UTC day, as rows are keyed by UTC date
	const maxAllowed = maxDate ?? today

	// Local state for custom inputs — commits to onChange only on Apply, so
	// half-typed dates don't clobber the active preset mid-edit.
	const [customFrom, setCustomFrom] = useState<string>(value?.kind === 'custom' ? value.from : '')
	const [customTo, setCustomTo] = useState<string>(value?.kind === 'custom' ? value.to : '')

	// The custom inputs restart from the selected range whenever the selection changes.
	const [syncedValue, setSyncedValue] = useState(value)
	if (value !== syncedValue) {
		setSyncedValue(value)
		setCustomFrom(value?.kind === 'custom' ? value.from : '')
		setCustomTo(value?.kind === 'custom' ? value.to : '')
	}

	const activePreset: DateRangePreset | null = value?.kind === 'preset' ? value.preset : null
	// "All" reads as "selected" when there is no filter — zero-state is literally "all time".
	const isAllSelected = !value || activePreset === 'all'
	const isActive = !!value && !(value.kind === 'preset' && value.preset === 'all')

	const handlePresetClick = (preset: DateRangePreset) => {
		setCustomFrom('')
		setCustomTo('')
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
		popover.getState().disclosureElement?.focus()
		onChange(null)
		popover.hide()
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<PopoverSelectTrigger
				ref={triggerRef}
				disabled={disabled}
				variant="filter"
				size="md"
				className="max-w-72 shrink-0"
			>
				<span className="shrink-0">Date range: </span>
				<span className={`truncate ${isActive ? 'text-link' : 'text-tertiary'}`}>
					{isActive && value ? formatDateRangeLong(value) : 'All'}
				</span>
			</PopoverSelectTrigger>

			<PopoverSurface variant="panel" heading="Date range" width="lg">
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

					{/* The surface unmounts on hide, so each opening starts with no errors; the drafts live here and survive it. */}
					<CustomRangeForm
						from={customFrom}
						to={customTo}
						setFrom={setCustomFrom}
						setTo={setCustomTo}
						minDate={minDate}
						maxDate={maxAllowed}
						onApply={(from, to) => {
							onChange({ kind: 'custom', from, to })
							popover.hide()
						}}
						onClear={handleClear}
					/>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

/** A typed day outside the dataset's days exports nothing. The inputs' min/max only shape the calendar: the form is
    noValidate, so the browser no longer refuses them. Days are YYYY-MM-DD UTC strings, which compare in date order. */
function outOfRange(day: string, minDate: string | undefined, maxDate: string) {
	if (minDate && day < minDate) return `Choose a date on or after ${formatDate(minDate)}.`
	if (day > maxDate) return `Choose a date on or before ${formatDate(maxDate)}.`
	return null
}

function CustomRangeForm({
	from,
	to,
	setFrom,
	setTo,
	minDate,
	maxDate,
	onApply,
	onClear
}: {
	from: string
	to: string
	setFrom: (value: string) => void
	setTo: (value: string) => void
	minDate: string | undefined
	maxDate: string
	onApply: (from: string, to: string) => void
	onClear: () => void
}) {
	const [submitted, setSubmitted] = useState(false)
	const fromError = from ? outOfRange(from, minDate, maxDate) : 'Choose a From date.'
	const toError = !to
		? 'Choose a To date.'
		: (outOfRange(to, minDate, maxDate) ?? (from > to ? 'Choose a date on or after the From date.' : null))

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault()
				if (fromError || toError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
				onApply(from, to)
			}}
			className="flex flex-col gap-2 border-t border-subtle pt-3"
		>
			<h3 className="label-sm text-secondary">Custom range</h3>
			<div className="grid grid-cols-2 gap-2">
				<Field label="From" error={submitted ? fromError : null}>
					{(control) => (
						<Input
							{...control}
							type="date"
							value={from}
							onChange={(e) => setFrom(e.currentTarget.value)}
							min={minDate}
							max={to || maxDate}
							className="w-full min-w-0 cursor-pointer"
						/>
					)}
				</Field>
				<Field label="To" error={submitted ? toError : null}>
					{(control) => (
						<Input
							{...control}
							type="date"
							value={to}
							onChange={(e) => setTo(e.currentTarget.value)}
							min={from || minDate}
							max={maxDate}
							className="w-full min-w-0 cursor-pointer"
						/>
					)}
				</Field>
			</div>
			<div className="flex justify-end gap-1.5 pt-1">
				<Button type="button" variant="secondary" size="md" onClick={onClear}>
					Clear
				</Button>
				<Button type="submit" variant="primary" size="md">
					Apply
				</Button>
			</div>
		</form>
	)
}
