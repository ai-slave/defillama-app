import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
// @vitest-environment happy-dom
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { useImageUpload } from '../useImageUpload'
import { usePdfUpload } from '../usePdfUpload'
const session = installSubscriberSession('article-editor')

test.each([
	{
		name: 'image',
		useUpload: () => useImageUpload({ scope: 'article-cover' }),
		filename: 'cover.png',
		mime: 'image/png'
	},
	{
		name: 'PDF',
		useUpload: () => usePdfUpload({ articleId: 'article' }),
		filename: 'report.pdf',
		mime: 'application/pdf'
	}
])(
	'$name upload stays busy while reading the file and recovers from a read failure',
	async ({ useUpload, filename, mime }) => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		const container = document.createElement('div')
		document.body.append(container)
		const root = createRoot(container)
		let upload!: { uploadFile: (file: File) => Promise<unknown>; isUploading: boolean }
		function Harness() {
			upload = useUpload()
			return (
				<button type="button" disabled={upload.isUploading}>
					Upload
				</button>
			)
		}
		let reject!: (error: Error) => void
		const file = new File(['content'], filename, { type: mime })
		vi.spyOn(file, 'arrayBuffer').mockReturnValue(
			new Promise((_, fail) => {
				reject = fail
			})
		)
		try {
			await act(async () =>
				root.render(
					<session.Wrapper>
						<Harness />
					</session.Wrapper>
				)
			)
			let result!: Promise<unknown>
			await act(async () => {
				result = upload.uploadFile(file).catch((error) => error)
			})
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0))
			})
			expect(container.querySelector('button')!.disabled).toBe(true)
			expect(session.requests.filter(({ url }) => url.pathname.startsWith('/uploads/'))).toHaveLength(0)
			await act(async () => reject(new Error('Read failed')))
			expect(await result).toMatchObject({ message: 'Read failed' })
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 0))
			})
			expect(container.querySelector('button')!.disabled).toBe(false)
		} finally {
			await act(async () => root.unmount())
			container.remove()
		}
	}
)
