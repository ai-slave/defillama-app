// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useProjectFileUpload } from './useProjectFileUpload'

const mutateAsync = vi.fn()
vi.mock('./hooks', () => ({ useUploadProjectFiles: () => ({ mutateAsync, isPending: false }) }))
let root: Root
let api: ReturnType<typeof useProjectFileUpload>
function Probe() {
	api = useProjectFileUpload('project')
	return null
}
beforeEach(async () => {
	mutateAsync.mockReset()
	root = createRoot(document.createElement('div'))
	await act(async () => root.render(<Probe />))
})
afterEach(async () => {
	await act(async () => root.unmount())
})

test('summarizes client and server rejections together without discarding accepted files', async () => {
	mutateAsync.mockResolvedValue({
		imported: [{ filename: 'ok.csv' }],
		skipped: [{ path: 'duplicate.csv', reason: 'Already exists' }]
	})
	const ok = new File(['a'], 'ok.csv')
	const duplicate = new File(['a'], 'duplicate.csv')
	await act(async () => api.handleFiles([ok, new File(['x'], 'archive.zip'), duplicate]))
	expect(mutateAsync).toHaveBeenCalledWith([ok, duplicate])
	expect(api.feedback).toMatchObject({
		added: 1,
		skipped: [{ filename: 'archive.zip' }, { filename: 'duplicate.csv', reason: 'Already exists' }]
	})
	await act(async () => api.dismissFeedback())
	expect(api.feedback).toBeNull()
})

test('keeps failed project upload details visible', async () => {
	mutateAsync.mockRejectedValue(new Error('Project storage quota exceeded'))
	await act(async () => api.handleFiles([new File(['a'], 'ok.csv')]))
	expect(api.feedback).toEqual({
		added: 0,
		skipped: [{ filename: 'ok.csv', reason: 'Project storage quota exceeded' }]
	})
})
