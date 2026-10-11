import * as Ariakit from '@ariakit/react'
import { useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { NestedMenu } from '~/components/NestedMenu'
import { selectTriggerStyles } from '~/components/Select/types'
import type { FormSubmitHandler } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'
import { metricOptionChipStyles } from '~/ui/MetricChip'
import { PopoverSurface } from '~/ui/PopoverSurface'

type RangeQuickPick = { label: string; value: number }

interface IFilterBetweenRange {
	trigger: ReactNode
	/** Names the phone drawer; the trigger may carry the current range. */
	heading: string
	onSubmit: FormSubmitHandler
	onClear: () => void
	nestedMenu?: boolean
	min: number | string | null
	max: number | string | null
	variant: 'primary' | 'secondary'
	size: 'sm' | 'md'
	placement?: Ariakit.PopoverStoreProps['placement']
	minLabel?: string
	maxLabel?: string
	minInputProps?: InputHTMLAttributes<HTMLInputElement>
	maxInputProps?: InputHTMLAttributes<HTMLInputElement>
	/**
	 * Min chips. Take the values from `rangeQuickPicks` over the rows the other filters keep, never a fixed
	 * list: a fixed step empties the table on a page whose rows all sit below it.
	 */
	quickPicks?: ReadonlyArray<RangeQuickPick>
}

export function FilterBetweenRange({
	trigger,
	heading,
	onSubmit: handleSubmit,
	onClear,
	nestedMenu,
	min,
	max,
	variant,
	size,
	placement = 'bottom-end',
	minLabel = 'Min',
	maxLabel = 'Max',
	minInputProps,
	maxInputProps,
	quickPicks
}: IFilterBetweenRange) {
	const popover = Ariakit.usePopoverStore({
		placement
	})

	if (nestedMenu) {
		return (
			<NestedMenu label={trigger} render={<button type="button" />}>
				<Form
					inset="nested"
					onSubmit={handleSubmit}
					onClear={onClear}
					min={min}
					max={max}
					minLabel={minLabel}
					maxLabel={maxLabel}
					minInputProps={minInputProps}
					maxInputProps={maxInputProps}
					quickPicks={quickPicks}
				/>
			</NestedMenu>
		)
	}

	return (
		<Ariakit.PopoverProvider store={popover}>
			<Ariakit.PopoverDisclosure
				// The trigger opens a picker-like panel, so it wears the Select trigger beside the other filters.
				className={`${selectTriggerStyles(variant === 'primary' ? 'filter' : 'default', size)} justify-between`}
			>
				{trigger}
				<Ariakit.PopoverDisclosureArrow className="size-3 shrink-0" />
			</Ariakit.PopoverDisclosure>

			<PopoverSurface
				variant="list"
				heading={heading}
				overflowPadding={16} // distance from the boundary edges
			>
				<div className="mx-auto w-full sm:w-[260px]">
					<Form
						inset="popover"
						min={min}
						max={max}
						onSubmit={(e) => {
							handleSubmit(e)
							popover.hide()
						}}
						onClear={() => {
							onClear()
							popover.hide()
						}}
						minLabel={minLabel}
						maxLabel={maxLabel}
						minInputProps={minInputProps}
						maxInputProps={maxInputProps}
						quickPicks={quickPicks}
					/>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

/** Every range filter keeps rows between both bounds, so an inverted range would show an empty table. */
function invertedRangeError(min: string, max: string) {
	return min !== '' && max !== '' && Number(min) > Number(max) ? 'Enter a max no lower than the min.' : null
}

function Form({
	inset,
	onSubmit,
	onClear,
	min,
	max,
	minLabel,
	maxLabel,
	minInputProps,
	maxInputProps,
	quickPicks
}: {
	/** A nested phone menu's rows sit 16px from the edge, a popover's 12px. */
	inset: 'popover' | 'nested'
	onSubmit: FormSubmitHandler
	onClear: () => void
	min: number | string | null
	max: number | string | null
	minLabel: string
	maxLabel: string
	minInputProps?: InputHTMLAttributes<HTMLInputElement>
	maxInputProps?: InputHTMLAttributes<HTMLInputElement>
	quickPicks?: ReadonlyArray<RangeQuickPick>
}) {
	const formRef = useRef<HTMLFormElement>(null)
	const minRef = useRef<HTMLInputElement>(null)
	// The inputs stay uncontrolled, as callers read the submitted form; these copies drive the quick picks and the error.
	const [minValue, setMinValue] = useState(String(min ?? ''))
	const [maxValue, setMaxValue] = useState(String(max ?? ''))
	const [submitted, setSubmitted] = useState(false)
	const rangeError = invertedRangeError(minValue, maxValue)
	const pickMin = (value: number) => {
		if (minRef.current) minRef.current.value = String(value)
		setMinValue(String(value))
		formRef.current?.requestSubmit()
	}
	return (
		<form
			ref={formRef}
			noValidate
			onSubmit={(event) => {
				// Read from the form: a quick pick sets the min and submits before its state renders.
				const form = event.currentTarget
				if (invertedRangeError(form.min.value, form.max.value)) {
					event.preventDefault()
					return showFieldErrors(event.currentTarget, () => setSubmitted(true))
				}
				onSubmit(event)
			}}
			onReset={() => {
				setMinValue('')
				setMaxValue('')
				setSubmitted(false)
				onClear()
			}}
			// A sheet row: on phones its fields and buttons are 44px, like a form in a dialog sheet.
			data-sheet
			className={`flex flex-col gap-3 py-3 ${inset === 'nested' ? 'px-4' : 'px-3'}`}
		>
			<div className="flex flex-col gap-1.5">
				<Field label={minLabel}>
					{(control) => (
						<Input
							{...control}
							ref={minRef}
							type="number"
							name="min"
							defaultValue={min ?? ''}
							{...minInputProps}
							onInput={(e) => setMinValue(e.currentTarget.value)}
							className="w-full"
						/>
					)}
				</Field>
				{quickPicks?.length ? (
					<div className="flex flex-wrap gap-1.5">
						{quickPicks.map((pick) => (
							<button
								key={pick.value}
								type="button"
								onClick={() => pickMin(pick.value)}
								aria-pressed={Number(minValue) === pick.value}
								data-active={Number(minValue) === pick.value}
								className={metricOptionChipStyles}
							>
								{pick.label}
							</button>
						))}
					</div>
				) : null}
			</div>
			<Field label={maxLabel} error={submitted ? rangeError : null}>
				{(control) => (
					<Input
						{...control}
						type="number"
						name="max"
						defaultValue={max ?? ''}
						{...maxInputProps}
						onInput={(e) => setMaxValue(e.currentTarget.value)}
						className="w-full"
					/>
				)}
			</Field>

			<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
				<Button type="reset" size="md" className="w-full">
					Clear
				</Button>
				<Button type="submit" variant="primary" size="md" className="w-full">
					Apply filter
				</Button>
			</div>
		</form>
	)
}
