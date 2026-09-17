import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
import {
	menuSurfaceStyles,
	popoverMenuItemStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import type { Dashboard, DashboardTeam } from '../dashboardTypes'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { ProButton } from '../ui'
import { ConfirmationModal } from './ConfirmationModal'
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
	const deletion = useMutation({
		mutationFn: () => onDelete!(),
		onSuccess: () => setShowDeleteConfirm(false)
	})

	if (!onOpenSettings && !onDuplicate && !onNewDashboard && !onDelete && !moveTeam) return null

	return (
		<>
			<Ariakit.MenuProvider placement="bottom-end">
				<Ariakit.MenuButton
					render={<ProButton type="button" square variant="secondary" />}
					aria-label="Dashboard actions"
					title="Dashboard actions"
				>
					<Icon name="ellipsis" height={16} width={16} />
				</Ariakit.MenuButton>
				<Ariakit.Menu
					portal
					unmountOnHide
					gutter={8}
					className={menuSurfaceStyles}
					wrapperProps={{ className: popoverMobileWrapperClassName }}
					aria-label="Dashboard actions"
				>
					<Ariakit.PopoverDismiss aria-label="Close menu" className={popoverMobileDismissStyles}>
						<Icon name="x" className="size-5" />
					</Ariakit.PopoverDismiss>
					{onOpenSettings ? (
						<Ariakit.MenuItem
							className={popoverMenuItemStyles}
							aria-label="Dashboard Settings"
							onClick={onOpenSettings}
						>
							<Icon name="settings" height={14} width={14} />
							<span>Settings</span>
						</Ariakit.MenuItem>
					) : null}
					{onDuplicate ? (
						<Ariakit.MenuItem
							className={popoverMenuItemStyles}
							disabled={duplicate.isPending}
							accessibleWhenDisabled
							onClick={() => {
								if (onDuplicateBlocked) return onDuplicateBlocked()
								duplicate.mutate()
							}}
						>
							<Icon name="copy" height={14} width={14} />
							<span>{duplicate.isPending ? 'Duplicating…' : 'Duplicate'}</span>
						</Ariakit.MenuItem>
					) : null}
					{onNewDashboard ? (
						<Ariakit.MenuItem className={popoverMenuItemStyles} onClick={onNewDashboard}>
							<Icon name="plus" height={14} width={14} />
							<span>New dashboard</span>
						</Ariakit.MenuItem>
					) : null}
					{moveTeam ? (
						<Ariakit.MenuItem
							className={popoverMenuItemStyles}
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
						</Ariakit.MenuItem>
					) : null}
					{onDelete ? (
						<>
							<Ariakit.MenuSeparator className="my-1 border-pro-cards-border" />
							<Ariakit.MenuItem
								className={`${popoverMenuItemStyles} text-error`}
								data-umami-event="dashboard-delete"
								onClick={() => {
									deletion.reset()
									setShowDeleteConfirm(true)
								}}
							>
								<Icon name="trash-2" height={14} width={14} />
								<span>Delete dashboard…</span>
							</Ariakit.MenuItem>
						</>
					) : null}
				</Ariakit.Menu>
			</Ariakit.MenuProvider>
			<ConfirmationModal
				isOpen={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={() => {
					if (!deletion.isPending) deletion.mutate()
				}}
				closeOnConfirm={false}
				pending={deletion.isPending}
				pendingText="Deleting…"
				error={deletion.isError ? 'Could not delete the dashboard. Please try again.' : null}
				title="Delete Dashboard"
				message="Are you sure you want to delete this dashboard? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
			/>
		</>
	)
}
