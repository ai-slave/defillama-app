// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProjectsGrid } from './ProjectsGrid'
import type { ProjectWithStats } from './types'

const mocks = vi.hoisted(() => ({ push: vi.fn(), renamed: vi.fn(), deleted: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ user: { id: 'user' }, hasActiveSubscription: true, isTrial: false })
}))
vi.mock('./hooks', () => ({
	useProjectUsage: () => ({ data: { limits: { projects: 10 } } }),
	useProjectList: () => ({
		data: [
			{ id: 'research', name: 'Research', updated_at: '2026-09-01', file_count: 0, total_bytes: 0 } as ProjectWithStats
		]
	})
}))
vi.mock('./CreateProjectModal', () => ({
	CreateProjectModal: ({ mode, project }: { mode?: string; project?: ProjectWithStats }) => {
		if (mode === 'rename') {
			mocks.renamed(project?.id)
		}
		return null
	}
}))
vi.mock('./DeleteProjectModal', () => ({
	DeleteProjectModal: ({ project }: { project: ProjectWithStats | null }) => {
		mocks.deleted(project?.id)
		return null
	}
}))

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<ProjectsGrid />))
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('project cards have a real link with separate rename and delete controls', async () => {
	const link = container.querySelector<HTMLAnchorElement>('a[href="/ai/projects/research"]')!
	expect(link.textContent).toBe('Research')
	expect(link.querySelector('button')).toBeNull()
	await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Rename Research"]')!.click())
	expect(mocks.renamed).toHaveBeenLastCalledWith('research')
	await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Delete Research"]')!.click())
	expect(mocks.deleted).toHaveBeenLastCalledWith('research')
	expect(mocks.push).not.toHaveBeenCalled()
})
