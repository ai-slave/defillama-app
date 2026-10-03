import * as Ariakit from '@ariakit/react'
import { useId, useState } from 'react'
import { selectTriggerStyles } from '~/components/Select/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'
import { formatNumber } from '~/utils/numberFormat'

const PRESETS = [50, 100, 500, 1000] as const

interface RowLimitPickerProps {
	value: number | null // null = no limit / show all rows
	totalRows: number // used to show "of N" in trigger + validate custom input
	onChange: (value: number | null) => void
	disabled?: boolean
}

export function RowLimitPicker({ value, totalRows, onChange, disabled }: RowLimitPickerProps) {
	const id = useId()
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
		setCustomInput('')
		setError(null)
		onChange(n)
		popover.hide()
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				disabled={disabled}
				className={`${selectTriggerStyles('filter', 'md')} max-w-72 shrink-0`}
			>
				<span className="shrink-0">Row limit: </span>
				<span className={`truncate ${isActive ? 'text-link' : 'text-tertiary'}`}>
					{isActive && value
						? `Top ${formatNumber(value)}${totalRows > 0 ? ` of ${formatNumber(totalRows)}` : ''}`
						: 'All'}
				</span>
				<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
			</Ariakit.PopoverDisclosure>

			<PopoverSurface variant="panel" heading="Row limit" className="w-72">
				<div className="flex flex-col gap-3 p-3">
					<section className="flex flex-col gap-2">
						<h3 className="label-sm text-secondary">Top rows</h3>
						<div className="flex flex-wrap gap-1">
							{[...PRESETS, null].map((n) => {
								const isSelected = n === null ? !isActive : value === n
								return (
									<Button
										key={n ?? 'all'}
										type="button"
										variant="toggle"
										size="sm"
										data-active={isSelected}
										aria-pressed={isSelected}
										onClick={() => handlePresetClick(n)}
									>
										{n === null ? 'All' : formatNumber(n)}
									</Button>
								)
							})}
						</div>
					</section>

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
						className="flex flex-col gap-2 border-t border-subtle pt-3"
					>
						<label htmlFor={`${id}-custom`} className="label-sm text-secondary">
							Custom
						</label>
						<div className="flex items-center gap-2">
							<Input
								id={`${id}-custom`}
								type="number"
								aria-label="Custom row limit"
								aria-invalid={!!error}
								aria-describedby={error ? `${id}-error` : undefined}
								min={1}
								inputMode="numeric"
								value={customInput}
								onChange={(e) => {
									setCustomInput(e.currentTarget.value)
									setError(null)
								}}
								placeholder="e.g. 250"
								className="min-w-0 flex-1"
							/>
							<Button type="submit" variant="primary" size="md" disabled={!customInput}>
								Apply
							</Button>
						</div>
						{error ? (
							<p id={`${id}-error`} role="alert" className="body-sm text-error">
								{error}
							</p>
						) : null}
					</form>

					<p className="body-sm text-tertiary">Applied after sort: the top N by the current sort order.</p>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
