import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import toast from 'react-hot-toast'
import { DialogCloseButton, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
export interface DashboardSheetAction {
	label: string
	icon: ComponentProps<typeof Icon>['name']
	onSelect: () => void | Promise<void>
	emphasis?: 'primary' | 'ai'
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
				className="flex items-center gap-2 rounded-md border pro-border pro-hover-bg px-3 py-2 md:hidden"
			>
				{selection.isPending ? <LoadingSpinner size={16} /> : <Icon name="ellipsis" height={16} width={16} />}
				Actions
			</Ariakit.DialogDisclosure>
			<Ariakit.Dialog className={`${dialogSurfaceStyles} pro-dashboard [--dialog-width:420px]`} portal unmountOnHide>
				<div className="flex items-center justify-between p-4">
					<Ariakit.DialogHeading>Dashboard actions</Ariakit.DialogHeading>
					<DialogCloseButton />
				</div>
				<div className={`${dialogScrollableBodyStyles} flex flex-col gap-2 p-4`}>
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							className={`flex w-full items-center gap-2 rounded-md px-4 py-3 ${action.emphasis === 'primary' ? 'pro-btn-primary' : action.emphasis === 'ai' ? 'pro-btn-primary-outline' : 'pro-hover-bg'}`}
							onClick={() => {
								store.hide()
								selection.mutate(action)
							}}
						>
							<Icon name={action.icon} height={16} width={16} />
							{action.label}
						</button>
					))}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
