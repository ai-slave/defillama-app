// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { ImageUploadButton } from '../ImageUploadButton'

const session = installSubscriberSession('editor-1')
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function Field({ previewShape }: { previewShape: 'square' | 'wide' }) {
	const [url, setUrl] = useState<string | null>('/logo.png')
	return (
		<ImageUploadButton
			scope="trusted-logo"
			currentUrl={url}
			onUploaded={(result) => setUrl(result.url)}
			onCleared={() => setUrl(null)}
			label="logo image"
			previewShape={previewShape}
		/>
	)
}
const button = (name: string) =>
	[...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => accessibleName(b) === name)

test.each(['square', 'wide'] as const)(
	'%s: every control names its image, Remove hands focus to the upload control, and the file input is out of the tab order',
	async (previewShape) => {
		await act(async () =>
			root.render(
				<session.Wrapper>
					<Field previewShape={previewShape} />
				</session.Wrapper>
			)
		)
		expect(button('Replace logo image')).toBeDefined()
		expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.hidden).toBe(true)
		await act(async () => {
			button('Remove logo image')!.focus()
			button('Remove logo image')!.click()
		})
		expect(accessibleName(document.activeElement!)).toBe('Upload logo image')
	}
)
