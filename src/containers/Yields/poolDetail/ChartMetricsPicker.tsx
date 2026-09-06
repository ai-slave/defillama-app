// "Add Metrics" picker: a disclosure button, grouped option chips in a dialog, and the
// selected series as removable chips beside it. Option counts are small, so no search box.
import * as Ariakit from '@ariakit/react'
import { Button, buttonStyles } from '~/ui/Button'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { metricChipStyles, metricOptionChipStyles } from '~/ui/MetricChip'

export interface ChartMetricOption {
	key: string
	label: string
	/** Series color resolved for the active theme; borders the chips. */
	color: string
	active: boolean
	/** The series default, so removing a metric clears the URL override instead of pinning one. */
	defaultEnabled: boolean
}

export interface ChartMetricGroup {
	label: string
	options: Array<ChartMetricOption>
}

export function ChartMetricsPicker({
	groups,
	onToggle
}: {
	groups: Array<ChartMetricGroup>
	onToggle: (option: ChartMetricOption) => void
}) {
	const dialogStore = Ariakit.useDialogStore()
	const options = groups.flatMap((group) => group.options)
	if (options.length === 0) return null
	const selected = options.filter((option) => option.active)

	return (
		<>
			<Ariakit.DialogProvider store={dialogStore}>
				<Ariakit.DialogDisclosure className={buttonStyles({ size: 'md' })}>
					<span>Add Metrics</span>
					<Icon name="plus" className="size-3.5" />
				</Ariakit.DialogDisclosure>
				<Ariakit.Dialog className={`${dialogSurfaceStyles} [--dialog-width:480px]`} unmountOnHide portal>
					<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
						<div className="flex items-baseline gap-2.5">
							<DialogHeading>Chart metrics</DialogHeading>
							<span className="body-sm text-tertiary">
								{selected.length}/{options.length}
							</span>
						</div>
						<DialogCloseButton className="-mr-1" />
					</div>

					<div className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
						{groups
							.filter((group) => group.options.length > 0)
							.map((group) => (
								<section key={group.label} className="flex flex-col gap-2">
									<span className="label-xs tracking-wide text-tertiary uppercase">{group.label}</span>
									<div className="flex flex-wrap gap-1">
										{group.options.map((option) => (
											<button
												key={option.key}
												type="button"
												onClick={() => onToggle(option)}
												aria-pressed={option.active}
												data-active={option.active}
												className={metricOptionChipStyles}
											>
												{option.active ? (
													<span
														aria-hidden
														className="size-1.5 rounded-full"
														style={{
															backgroundColor: `color-mix(in oklch, ${option.color} 75%, var(--text-secondary))`
														}}
													/>
												) : (
													<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" />
												)}
												<span>{option.label}</span>
												{option.active ? (
													<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
												) : null}
											</button>
										))}
									</div>
								</section>
							))}
					</div>

					<div className="flex items-center justify-end gap-2 border-t border-subtle bg-overlay px-4 py-3">
						<Button type="button" variant="primary" size="md" onClick={() => dialogStore.hide()}>
							Done
						</Button>
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>

			{selected.map((option) => (
				<button
					key={option.key}
					type="button"
					onClick={() => onToggle(option)}
					className={metricChipStyles}
					style={{ borderColor: option.color }}
				>
					<span>{option.label}</span>
					<Icon name="x" className="size-4" />
					<span className="sr-only">Remove {option.label}</span>
				</button>
			))}
		</>
	)
}
