import * as Ariakit from '@ariakit/react'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { NoResults } from '~/ui/NoResults'
import { popoverMenuItemStyles } from '~/ui/Popover'
import { NestedDrawerHeader } from '~/ui/PopoverSurface'
import { ErrorLine, LoadingIndicator } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
import { useMoveSessionToProject, useProjectList } from './hooks'

interface MoveToProjectMenuItemProps {
	sessionId: string
	currentProjectId?: string | null
}

const PARENT_ITEM_CLASS = `${popoverMenuItemStyles} border-b border-subtle last-of-type:border-b-0`

export function MoveToProjectMenuItem({ sessionId, currentProjectId = null }: MoveToProjectMenuItemProps) {
	const menu = Ariakit.useMenuStore()
	const projects = useProjectList()
	const move = useMoveSessionToProject()
	const failed = queryReadFailed(projects)

	const onMove = (projectId: string | null) => {
		if (projectId === currentProjectId) return
		// Feedback lives on the mutation: choosing a destination closes this menu, and its unmountOnHide
		// would drop a callback passed here before the request settles.
		move.mutate({ sessionId, projectId, previousProjectId: currentProjectId })
	}

	return (
		<Ariakit.MenuProvider store={menu}>
			<Ariakit.MenuItem render={<Ariakit.MenuButton />} className={PARENT_ITEM_CLASS}>
				<Icon name="folder-plus" className="size-3.5 shrink-0" />
				<span className="flex-1 text-left">Move to project</span>
				<Icon name="chevron-right" className="size-3.5 shrink-0 text-tertiary" />
			</Ariakit.MenuItem>
			<MenuSurface variant="nested" composite={false} aria-label="Move to project" gutter={4}>
				<NestedDrawerHeader
					title="Move to project"
					backLabel="Back to session actions"
					onBack={menu.hide}
					closeLabel="Close session menus"
					onClose={menu.hideAll}
				/>
				{failed ? (
					<ErrorLine inset="menuRow">Couldn&apos;t load your projects.</ErrorLine>
				) : projects.isFetching ? (
					<div role="status" className="flex justify-center px-3 py-2">
						<LoadingIndicator label="Loading projects" />
					</div>
				) : !projects.data?.length ? (
					<NoResults>No projects yet</NoResults>
				) : null}
				<Ariakit.MenuList store={menu} aria-label="Project destinations">
					{failed ? (
						<MenuItem
							hideOnClick={false}
							disabled={projects.isFetching}
							accessibleWhenDisabled
							onClick={() => void projects.refetch()}
						>
							{projects.isFetching ? 'Retrying…' : 'Try again'}
						</MenuItem>
					) : projects.data ? (
						<>
							{projects.data.map((p) => {
								const isCurrentProject = p.id === currentProjectId
								return (
									<MenuItem key={p.id} onClick={() => void onMove(p.id)} disabled={isCurrentProject || move.isPending}>
										<Icon name={isCurrentProject ? 'check' : 'folder'} className="size-3.5 shrink-0 opacity-70" />
										<span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
									</MenuItem>
								)
							})}
							{currentProjectId ? (
								<MenuItem
									onClick={() => void onMove(null)}
									disabled={move.isPending}
									className="border-t border-subtle"
								>
									<Icon name="x" className="size-3.5 shrink-0 opacity-70" />
									<span className="min-w-0 flex-1 truncate text-left">Remove from project</span>
								</MenuItem>
							) : null}
						</>
					) : null}
				</Ariakit.MenuList>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
