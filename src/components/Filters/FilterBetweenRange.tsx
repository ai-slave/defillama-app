import * as Ariakit from '@ariakit/react'
import clsx from 'clsx'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Icon } from '~/components/Icon'
import { NestedMenu } from '~/components/NestedMenu'
import type { FormSubmitHandler } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Input } from '~/ui/Input'
import { popoverMobileDismissStyles, popoverMobileWrapperClassName, popoverSurfaceStyles } from '~/ui/Popover'

interface IFilterBetweenRange {
	trigger: ReactNode
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
}

export function FilterBetweenRange({
	trigger,
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
	maxInputProps
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

			<Ariakit.Popover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				overflowPadding={16} // distance from the boundary edges
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={popoverSurfaceStyles}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>

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
					/>
				</div>
			</Ariakit.Popover>
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
	maxInputProps
}: {
	onSubmit: FormSubmitHandler
	onClear: () => void
	min: number | string | null
	max: number | string | null
	minLabel: string
	maxLabel: string
	minInputProps?: InputHTMLAttributes<HTMLInputElement>
	maxInputProps?: InputHTMLAttributes<HTMLInputElement>
}) {
	return (
		<form onSubmit={onSubmit} onReset={onClear} className="flex flex-col gap-3 p-3">
			<label className="flex flex-col gap-1">
				<span className="label-sm text-secondary">{minLabel}</span>
				<Input type="number" name="min" defaultValue={min ?? ''} {...minInputProps} className="w-full" />
			</label>
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
