import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useId, useState, type ComponentProps } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tooltip } from '~/ui/Tooltip'
import type { Dashboard, DashboardTeam } from '../dashboardTypes'
import { useProDashboardDashboard } from '../ProDashboardAPIContext'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { statusToastOptions, TOAST_DURATION_SHORT } from './dashboardToasts'

/** An editor toolbar action. Phones reach it from this menu; desktop shows it as a toolbar button. */
export interface DashboardMenuAction {
	label: string
	icon: ComponentProps<typeof Icon>['name']
	onSelect: () => void | Promise<void>
	disabled?: boolean
	/** The desktop tooltip. When the action is disabled it is the reason, shown as text in the phone menu. */
	title?: string
	umami?: string
}

interface DashboardOverflowMenuProps {
	/** The toolbar actions phones reach from this menu, listed above the dashboard actions. */
	phoneActions: Array<DashboardMenuAction>
	onOpenSettings?: (() => void) | undefined
	onDuplicate?: (() => Promise<Dashboard>) | undefined
	onDuplicateBlocked?: (() => void) | undefined
	onNewDashboard?: (() => void) | undefined
	onDelete?: (() => Promise<void>) | undefined
	/** Present only when the viewer may move the dashboard between personal and team. */
	moveTeam?: {
		team: DashboardTeam | null
		myTeam: DashboardTeam
		/** The creator gets the dashboard back; an admin only removes it from the team. */
		isCreator: boolean
		onMove: (teamId: string | null) => Promise<void>
	}
}

/** The dashboard's one actions menu: the "…" button from `md`, and below it an "Actions" button whose menu also
    holds the toolbar actions that do not fit a phone's header. Both share one set of handlers and one delete confirm. */
export function DashboardOverflowMenu({
	phoneActions,
	onOpenSettings,
	onDuplicate,
	onDuplicateBlocked,
	onNewDashboard,
	onDelete,
	moveTeam
}: DashboardOverflowMenuProps) {
	const router = useRouter()
	const id = useId()
	const { dashboardName } = useProDashboardDashboard()
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const move = useMutation({
		mutationFn: (teamId: string | null) => moveTeam!.onMove(teamId),
		onSuccess: (_result, teamId) =>
			toast.success(
				teamId
					? `Shared with ${moveTeam!.myTeam.name}`
					: moveTeam!.isCreator
						? 'Moved to your dashboards'
						: 'Removed from the team',
				statusToastOptions('dashboard-move-team', TOAST_DURATION_SHORT)
			),
		onError: (error) => toast.error(error.message, { id: 'dashboard-move-team' })
	})
	const duplicate = useMutation({
		mutationFn: () => onDuplicate!(),
		onSuccess: (dashboard) => {
			void router
				.push(`/pro/${dashboardUrlKey(dashboard)}`)
				.then(() => toast.success('Copy created', statusToastOptions('dashboard-duplicate', TOAST_DURATION_SHORT)))
				.catch(() => {
					toast.error('Dashboard copied, but navigation failed. Open it from My dashboards.')
				})
		},
		onError: (error) => toast.error(error.message, { id: 'dashboard-duplicate' })
	})
	const deletion = useMutation({ mutationFn: () => onDelete!() })
	const selection = useMutation({
		mutationFn: async (action: DashboardMenuAction) => {
			await action.onSelect()
		},
		onError: (error) => toast.error(error.message)
	})

	const hasDashboardActions = !!(onOpenSettings || onDuplicate || onNewDashboard || onDelete || moveTeam)
	if (!hasDashboardActions && phoneActions.length === 0) return null

	// The menu closes on a pick, so a running duplicate or move shows on the button that reopens it.
	const triggerIcon =
		duplicate.isPending || move.isPending ? <LoadingSpinner size={14} /> : <Icon name="ellipsis" className="size-4" />

	const dashboardItems = (
		<>
			{onOpenSettings ? (
				<MenuItem aria-label="Dashboard Settings" onClick={onOpenSettings}>
					<Icon name="settings" className="size-3.5" />
					<span>Settings</span>
				</MenuItem>
			) : null}
			{onDuplicate ? (
				<MenuItem
					disabled={duplicate.isPending}
					accessibleWhenDisabled
					onClick={() => {
						if (onDuplicateBlocked) return onDuplicateBlocked()
						duplicate.mutate()
					}}
				>
					<Icon name="copy" className="size-3.5" />
					<span>{duplicate.isPending ? 'Duplicating…' : 'Duplicate'}</span>
				</MenuItem>
			) : null}
			{onNewDashboard ? (
				<MenuItem onClick={onNewDashboard}>
					<Icon name="plus" className="size-3.5" />
					<span>New dashboard</span>
				</MenuItem>
			) : null}
			{moveTeam ? (
				<MenuItem
					disabled={move.isPending}
					accessibleWhenDisabled
					data-umami-event={moveTeam.team ? 'dashboard-move-personal' : 'dashboard-move-team'}
					onClick={() => move.mutate(moveTeam.team ? null : moveTeam.myTeam.id)}
				>
					<Icon name="users" className="size-3.5" />
					<span>
						{move.isPending
							? 'Moving…'
							: !moveTeam.team
								? `Share with ${moveTeam.myTeam.name}`
								: moveTeam.isCreator
									? 'Move to my dashboards'
									: 'Remove from team'}
					</span>
				</MenuItem>
			) : null}
			{onDelete ? (
				<>
					<Ariakit.MenuSeparator className="my-1 border-subtle" />
					<MenuItem destructive data-umami-event="dashboard-delete" onClick={() => setShowDeleteConfirm(true)}>
						<Icon name="trash-2" className="size-3.5" />
						<span>Delete dashboard…</span>
					</MenuItem>
				</>
			) : null}
		</>
	)

	return (
		<>
			{hasDashboardActions ? (
				<Ariakit.MenuProvider placement="bottom-end">
					<Tooltip
						content="Dashboard actions"
						render={
							<Ariakit.MenuButton
								render={<Button size="md" type="button" square variant="secondary" className="max-md:hidden" />}
								aria-label="Dashboard actions"
							/>
						}
					>
						{triggerIcon}
					</Tooltip>
					<MenuSurface variant="actions" aria-label="Dashboard actions">
						{dashboardItems}
					</MenuSurface>
				</Ariakit.MenuProvider>
			) : null}
			<Ariakit.MenuProvider placement="bottom-end">
				<Ariakit.MenuButton
					render={
						<Button
							type="button"
							variant="secondary"
							size="md"
							className="md:hidden"
							pendingLabel="Running…"
							pending={selection.isPending}
						/>
					}
				>
					{triggerIcon}
					Actions
				</Ariakit.MenuButton>
				<MenuSurface variant="actions" aria-label="Dashboard actions">
					{phoneActions.map((action, index) => {
						// Phones never show a title tooltip, so a disabled action states its reason in the row.
						const reasonId = action.disabled && action.title ? `${id}-${index}-reason` : undefined
						return (
							<MenuItem
								key={action.label}
								disabled={action.disabled}
								accessibleWhenDisabled
								{...(reasonId ? { 'aria-labelledby': `${id}-${index}-label`, 'aria-describedby': reasonId } : {})}
								{...(action.umami ? { 'data-umami-event': action.umami } : {})}
								onClick={() => selection.mutate(action)}
							>
								<Icon name={action.icon} className="size-3.5" />
								<span className="flex min-w-0 flex-col">
									<span id={`${id}-${index}-label`}>{action.label}</span>
									{reasonId ? (
										<span id={reasonId} className="body-xs text-tertiary">
											{action.title}
										</span>
									) : null}
								</span>
							</MenuItem>
						)
					})}
					{phoneActions.length > 0 && hasDashboardActions ? (
						<Ariakit.MenuSeparator className="my-1 border-subtle" />
					) : null}
					{dashboardItems}
				</MenuSurface>
			</Ariakit.MenuProvider>
			<span role="status" className="sr-only">
				{duplicate.isPending ? 'Duplicating dashboard…' : move.isPending ? 'Moving dashboard…' : ''}
			</span>
			{showDeleteConfirm ? (
				<ConfirmActionDialog
					title="Delete dashboard"
					description={`Deleting “${dashboardName}” cannot be undone.`}
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deletion}
					variables={undefined}
					onClose={() => setShowDeleteConfirm(false)}
				/>
			) : null}
		</>
	)
}
