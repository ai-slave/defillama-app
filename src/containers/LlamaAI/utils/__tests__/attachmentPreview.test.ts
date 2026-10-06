import { expect, test, vi } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { ATTACHMENT_PREVIEW_BYTES, readFilePreview, readUrlPreview } from '../attachmentPreview'

const fixtures = installFixtureFetch()

test('bounds large local previews and retains the complete original for download', async () => {
	const file = new File(['x'.repeat(ATTACHMENT_PREVIEW_BYTES + 10)], 'large.csv')
	const preview = await readFilePreview(file)
	expect(preview.content).toHaveLength(ATTACHMENT_PREVIEW_BYTES)
	expect(preview.truncated).toBe(true)
	expect(preview.original).toBe(file)
	expect((preview.original as File).size).toBe(ATTACHMENT_PREVIEW_BYTES + 10)
})

test('preserves small files and exact-size files without a truncated warning', async () => {
	for (const content of ['a,b\r\n1,2\r\n', '', 'x'.repeat(ATTACHMENT_PREVIEW_BYTES)]) {
		const preview = await readFilePreview(new File([content], 'small.csv'))
		expect(preview.content).toBe(content)
		expect(preview.truncated).toBe(false)
	}
})

test('does not display a broken UTF-8 character at the preview boundary', async () => {
	const preview = await readFilePreview(new File([`${'a'.repeat(ATTACHMENT_PREVIEW_BYTES - 1)}€`], 'unicode.txt'))
	expect(preview.content).toBe('a'.repeat(ATTACHMENT_PREVIEW_BYTES - 1))
	expect(preview.truncated).toBe(true)
})

test('stops a remote download after enough preview bytes and preserves its download URL', async () => {
	const cancel = vi.fn()
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new Uint8Array(ATTACHMENT_PREVIEW_BYTES + 100).fill(97))
		},
		cancel
	})
	fixtures.serve({ 'https://files/large.csv': () => new Response(stream) })
	const preview = await readUrlPreview('https://files/large.csv', 'large.csv')
	expect(preview.content).toHaveLength(ATTACHMENT_PREVIEW_BYTES)
	expect(preview.truncated).toBe(true)
	expect(preview.original).toBe('https://files/large.csv')
	expect(cancel).toHaveBeenCalledOnce()
})

test('reads small remote files completely and surfaces HTTP failures', async () => {
	fixtures.serve({
		'https://files/small.csv': () => new Response('a,b\n1,2'),
		'https://files/missing.csv': fixtureStatus(404, { error: 'Not found' })
	})
	expect(await readUrlPreview('https://files/small.csv', 'small.csv')).toMatchObject({
		content: 'a,b\n1,2',
		truncated: false
	})
	await expect(readUrlPreview('https://files/missing.csv', 'missing.csv')).rejects.toThrow('Failed to load attachment')
})
