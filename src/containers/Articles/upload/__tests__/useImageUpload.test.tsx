// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { useImageUpload } from '../useImageUpload'
const api = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ authorizedFetch: api.fetch }) }))

test('stays busy while reading the file and recovers from a read failure', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	let upload!: ReturnType<typeof useImageUpload>
	function Harness() {
		upload = useImageUpload({ scope: 'article-cover' })
		return (
			<button type="button" disabled={upload.isUploading}>
				Upload
			</button>
		)
	}
	let reject!: (error: Error) => void
	const file = new File(['image'], 'cover.png', { type: 'image/png' })
	vi.spyOn(file, 'arrayBuffer').mockReturnValue(
		new Promise((_, fail) => {
			reject = fail
		})
	)
	try {
		await act(async () => root.render(<Harness />))
		let result!: Promise<unknown>
		await act(async () => {
			result = upload.uploadFile(file).catch((error) => error)
		})
		expect(container.querySelector('button')!.disabled).toBe(true)
		expect(api.fetch).not.toHaveBeenCalled()
		await act(async () => reject(new Error('Read failed')))
		expect(await result).toMatchObject({ message: 'Read failed' })
		expect(container.querySelector('button')!.disabled).toBe(false)
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
