import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useId, type ComponentProps } from 'react'
import toast from 'react-hot-toast'
import { Dialog, DialogBody, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { ProButton, type ProButtonVariant } from '../ui'
export interface DashboardSheetAction {
	label: string
	icon: ComponentProps<typeof Icon>['name']
	onSelect: () => void | Promise<void>
	variant?: ProButtonVariant
	disabled?: boolean
	title?: string
}
export function DashboardActionsSheet({ actions }: { actions: Array<DashboardSheetAction> }) {
	const store = Ariakit.useDialogStore()
	const id = useId()
	const selection = useMutation({
		mutationFn: async (action: DashboardSheetAction) => {
			await action.onSelect()
		},
		onError: (error) => toast.error(error.message)
	})
	if (actions.length === 0) return null
	return (
		<Ariakit.DialogProvider store={store}>
			<Ariakit.DialogDisclosure
				disabled={selection.isPending}
				accessibleWhenDisabled
				render={
					<ProButton
						type="button"
						variant="secondary"
						className="md:hidden"
						icon={<Icon name="ellipsis" height={16} width={16} />}
						{...(selection.isPending ? { loading: true } : {})}
					/>
				}
			>
				Actions
			</Ariakit.DialogDisclosure>
			<Dialog size="sm" scope="pro" portal unmountOnHide>
				<DialogHeader title="Dashboard actions" />
				<DialogBody>
					<div className="flex flex-col gap-2">
						{actions.map((action, index) => {
							// The sheet is phone-only, where a title tooltip never shows: a disabled action states why in text.
							const reasonId = action.disabled && action.title ? `${id}-${index}-reason` : undefined
							return (
								// A reason hugs its own action (4px) and leaves 12px before the next, so it reads as that action's.
								<div
									key={action.label}
									className={`flex flex-col gap-1 ${reasonId && index < actions.length - 1 ? 'pb-1' : ''}`}
								>
									<ProButton
										type="button"
										variant={action.variant ?? 'secondary'}
										className="w-full"
										aria-disabled={action.disabled || undefined}
										aria-describedby={reasonId}
										onClick={() => {
											if (action.disabled) return
											store.hide()
											selection.mutate(action)
										}}
									>
										<span className="mr-auto flex items-center gap-1.5">
											<Icon name={action.icon} height={16} width={16} />
											{action.label}
										</span>
									</ProButton>
									{reasonId ? (
										<p id={reasonId} className="body-sm text-tertiary">
											{action.title}
										</p>
									) : null}
								</div>
							)
						})}
					</div>
				</DialogBody>
			</Dialog>
		</Ariakit.DialogProvider>
	)
}
