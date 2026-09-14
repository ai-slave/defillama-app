import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import toast from 'react-hot-toast'
import { DialogCloseButton, dialogScrollableBodyStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { ProButton, type ProButtonVariant, proDialogSm } from '../ui'
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
			<Ariakit.Dialog className={proDialogSm} portal unmountOnHide>
				<div className="flex items-center justify-between p-4">
					<Ariakit.DialogHeading>Dashboard actions</Ariakit.DialogHeading>
					<DialogCloseButton />
				</div>
				<div className={`${dialogScrollableBodyStyles} flex flex-col gap-2 p-4`}>
					{actions.map((action) => (
						<ProButton
							key={action.label}
							type="button"
							variant={action.variant ?? 'secondary'}
							className="w-full"
							aria-disabled={action.disabled || undefined}
							{...(action.title ? { title: action.title } : {})}
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
					))}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
