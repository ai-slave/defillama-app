// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useProjectFileUpload } from './useProjectFileUpload'

const mocks = vi.hoisted(() => ({
	mutateAsync: vi.fn()
}))

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

vi.mock('./hooks', () => ({
	useUploadProjectFiles: () => ({ mutateAsync: mocks.mutateAsync, isPending: false })
}))

function fileWithSize(name: string, size: number) {
	const file = new File(['content'], name, { type: 'text/plain' })
	Object.defineProperty(file, 'size', { value: size })
	return file
}

describe('useProjectFileUpload', () => {
	let container: HTMLDivElement
	let root: Root
	let upload: ReturnType<typeof useProjectFileUpload>

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		mocks.mutateAsync.mockResolvedValue({ imported: [], skipped: [] })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)

		function Harness() {
			upload = useProjectFileUpload('project-1')
			return null
		}

		await act(async () => root.render(<Harness />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('rejects a file larger than 100 MB before starting the upload', async () => {
		const oversized = fileWithSize('large.txt', 100 * 1024 * 1024 + 1)

		await act(async () => upload.handleFiles([oversized]))

		expect(mocks.mutateAsync).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith('Skipped large.txt: file exceeds 100 MB')
	})

	test('uploads valid files while skipping oversized files', async () => {
		const valid = fileWithSize('notes.txt', 100 * 1024 * 1024)
		const oversized = fileWithSize('large.txt', 100 * 1024 * 1024 + 1)

		await act(async () => upload.handleFiles([valid, oversized]))

		expect(mocks.mutateAsync).toHaveBeenCalledWith([valid])
		expect(toast.error).toHaveBeenCalledWith('Skipped large.txt: file exceeds 100 MB')
	})
})
