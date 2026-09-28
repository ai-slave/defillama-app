import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import { useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { NestedMenu } from '~/components/NestedMenu'
import type { FormSubmitHandler } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Input } from '~/ui/Input'
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
				className={clsx(
					'flex cursor-pointer flex-nowrap items-center justify-between gap-2 label-sm',
					{
						primary: 'relative border border-medium text-primary hover:bg-hover-row focus-visible:bg-hover-row',
						secondary:
							'bg-surface-elevated-1 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2'
					}[variant],
					{
						sm: 'min-h-6 rounded-md px-2 py-0.5',
						md: 'min-h-8 rounded-lg px-3 py-1.5'
					}[size]
				)}
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

function Form({
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
	const [minValue, setMinValue] = useState(String(min ?? ''))
	const pickMin = (value: number) => {
		if (minRef.current) minRef.current.value = String(value)
		setMinValue(String(value))
		formRef.current?.requestSubmit()
	}
	return (
		<form
			ref={formRef}
			onSubmit={onSubmit}
			onReset={() => {
				setMinValue('')
				onClear()
			}}
			className="flex flex-col gap-3 p-3"
		>
			<div className="flex flex-col gap-1.5">
				<label className="flex flex-col gap-1">
					<span className="label-sm text-secondary">{minLabel}</span>
					<Input
						ref={minRef}
						type="number"
						name="min"
						defaultValue={min ?? ''}
						{...minInputProps}
						onInput={(e) => setMinValue(e.currentTarget.value)}
						className="w-full"
					/>
				</label>
				{quickPicks?.length ? (
					<div className="flex flex-wrap gap-1.5">
						{quickPicks.map((pick) => (
							<button
								key={pick.value}
								type="button"
								onClick={() => pickMin(pick.value)}
								data-active={Number(minValue) === pick.value}
								className="hover-wash rounded-full border border-medium px-2 py-0.5 label-sm text-primary hover:border-brand focus-visible:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint"
							>
								{pick.label}
							</button>
						))}
					</div>
				) : null}
			</div>
			<label className="flex flex-col gap-1">
				<span className="label-sm text-secondary">{maxLabel}</span>
				<Input type="number" name="max" defaultValue={max ?? ''} {...maxInputProps} className="w-full" />
			</label>

			<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
				<Button type="reset" size="md" className="w-full">
					Clear
				</Button>
				<Button type="submit" variant="primary" size="md" className="w-full">
					Apply Filter
				</Button>
			</div>
		</form>
	)
}
