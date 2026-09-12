import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import {
	nestedPopoverMobileWrapperClassName,
	nestedMenuSurfaceStyles,
	nestedMenuHeaderIconButtonStyles,
	popoverMenuItemStyles
} from '~/ui/Popover'
import { useMoveSessionToProject, useProjectList } from './hooks'

interface MoveToProjectMenuItemProps {
	sessionId: string
	currentProjectId?: string | null
}

const PARENT_ITEM_CLASS = `${popoverMenuItemStyles} border-b border-subtle last-of-type:border-b-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-60`

export function MoveToProjectMenuItem({ sessionId, currentProjectId = null }: MoveToProjectMenuItemProps) {
	const menu = Ariakit.useMenuStore()
	const projects = useProjectList()
	const move = useMoveSessionToProject()

	const onMove = (projectId: string | null) => {
		if (projectId === currentProjectId) return
		// Feedback lives on the mutation: choosing a destination closes this menu, and its unmountOnHide
		// would drop a callback passed here before the request settles.
		move.mutate({ sessionId, projectId, previousProjectId: currentProjectId })
	}

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuItem render={<Ariakit.MenuButton />} className={PARENT_ITEM_CLASS}>
				<Icon name="folder-plus" height={14} width={14} className="shrink-0" />
				<span className="flex-1 text-left">Move to project</span>
				<Icon name="chevron-right" height={14} width={14} className="shrink-0 text-tertiary" />
			</Ariakit.MenuItem>
			<Ariakit.Menu
				portal
				composite={false}
				aria-label="Move to project"
				wrapperProps={{ className: nestedPopoverMobileWrapperClassName }}
				unmountOnHide
				gutter={4}
				className={`z-50 ${nestedMenuSurfaceStyles} max-sm:drawer-to-left`}
			>
				<div className="grid min-h-12 grid-cols-[2.5rem_1fr_2.5rem] items-center px-2 py-1 sm:hidden">
					<button
						type="button"
						aria-label="Back to session actions"
						className={nestedMenuHeaderIconButtonStyles}
						onClick={menu.hide}
					>
						<Icon name="chevron-left" className="size-4" />
					</button>
					<Ariakit.DialogHeading className="text-center label-md text-primary">Move to project</Ariakit.DialogHeading>
					<button
						type="button"
						aria-label="Close session menus"
						className={nestedMenuHeaderIconButtonStyles}
						onClick={menu.hideAll}
					>
						<Icon name="x" className="size-4" />
					</button>
				</div>
				{projects.isFetching ? (
					<div role="status" className="flex items-center justify-center gap-2 px-3 py-2 body-sm">
						<LoadingSpinner size={12} />
						Loading projects
					</div>
				) : projects.isError ? (
					<p role="alert" className="px-3 py-2 body-sm text-error">
						Failed to load projects
					</p>
				) : !projects.data?.length ? (
					<p role="status" className="px-3 py-2 body-sm text-tertiary">
						No projects yet
					</p>
				) : null}
				<Ariakit.MenuList store={menu} aria-label="Project destinations">
					{projects.isError ? (
						<Ariakit.MenuItem
							hideOnClick={false}
							disabled={projects.isFetching}
							accessibleWhenDisabled
							onClick={() => void projects.refetch()}
							className={popoverMenuItemStyles}
						>
							Retry
						</Ariakit.MenuItem>
					) : projects.data ? (
						<>
							{projects.data.map((p) => {
								const isCurrentProject = p.id === currentProjectId
								return (
									<Ariakit.MenuItem
										key={p.id}
										onClick={() => void onMove(p.id)}
										disabled={isCurrentProject || move.isPending}
										className={`${popoverMenuItemStyles} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
									>
										<Icon
											name={isCurrentProject ? 'check' : 'folder'}
											height={14}
											width={14}
											className="shrink-0 opacity-70"
										/>
										<span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
									</Ariakit.MenuItem>
								)
							})}
							{currentProjectId ? (
								<Ariakit.MenuItem
									onClick={() => void onMove(null)}
									disabled={move.isPending}
									className={`${popoverMenuItemStyles} border-t border-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
								>
									<Icon name="x" height={14} width={14} className="shrink-0 opacity-70" />
									<span className="min-w-0 flex-1 truncate text-left">Remove from project</span>
								</Ariakit.MenuItem>
							) : null}
						</>
					) : null}
				</Ariakit.MenuList>
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}
