import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import type { Dashboard, DashboardTeam } from '../dashboardTypes'
import { useProDashboardDashboard } from '../ProDashboardAPIContext'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { ProButton } from '../ui'
import { statusToastOptions, TOAST_DURATION_SHORT } from './dashboardToasts'

interface DashboardOverflowMenuProps {
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

export function DashboardOverflowMenu({
	onOpenSettings,
	onDuplicate,
	onDuplicateBlocked,
	onNewDashboard,
	onDelete,
	moveTeam
}: DashboardOverflowMenuProps) {
	const router = useRouter()
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

	if (!onOpenSettings && !onDuplicate && !onNewDashboard && !onDelete && !moveTeam) return null

	return (
		<>
			<Ariakit.MenuProvider placement="bottom-end">
				<Ariakit.MenuButton
					render={<ProButton type="button" square variant="secondary" />}
					aria-label="Dashboard actions"
					title="Dashboard actions"
				>
					{/* The menu closes on a pick, so a running duplicate or move shows on the button that reopens it. */}
					{duplicate.isPending || move.isPending ? (
						<LoadingSpinner size={14} />
					) : (
						<Icon name="ellipsis" height={16} width={16} />
					)}
				</Ariakit.MenuButton>
				<span role="status" className="sr-only">
					{duplicate.isPending ? 'Duplicating dashboard…' : move.isPending ? 'Moving dashboard…' : ''}
				</span>
				<MenuSurface variant="actions" aria-label="Dashboard actions">
					{onOpenSettings ? (
						<MenuItem aria-label="Dashboard Settings" onClick={onOpenSettings}>
							<Icon name="settings" height={14} width={14} />
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
							<Icon name="copy" height={14} width={14} />
							<span>{duplicate.isPending ? 'Duplicating…' : 'Duplicate'}</span>
						</MenuItem>
					) : null}
					{onNewDashboard ? (
						<MenuItem onClick={onNewDashboard}>
							<Icon name="plus" height={14} width={14} />
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
							<Icon name="users" height={14} width={14} />
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
								<Icon name="trash-2" height={14} width={14} />
								<span>Delete dashboard…</span>
							</MenuItem>
						</>
					) : null}
				</MenuSurface>
			</Ariakit.MenuProvider>
			{showDeleteConfirm ? (
				<ConfirmActionDialog
					scope="pro"
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
