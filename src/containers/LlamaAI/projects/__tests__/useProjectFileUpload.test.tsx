import { expect, test } from 'vitest'
import { LlamaAITransportError } from '../../api/transport'
import { getProjectUploadFeedback, partitionProjectUploadFiles } from '../useProjectFileUpload'

const ok = new File(['a'], 'ok.csv')
const duplicate = new File(['a'], 'duplicate.csv')

test('sends accepted files and rejects archives, oversized files, and unsupported types', () => {
	const huge = new File(['a'], 'big.md')
	Object.defineProperty(huge, 'size', { value: 100 * 1024 * 1024 + 1 })
	const { files, skipped } = partitionProjectUploadFiles([
		ok,
		new File(['x'], 'archive.zip'),
		huge,
		new File(['x'], 'image.png'),
		new File(['x'], 'Dockerfile'),
		duplicate
	])
	expect(files.map((file) => file.name)).toEqual(['ok.csv', 'Dockerfile', 'duplicate.csv'])
	expect(skipped).toEqual([
		{ filename: 'archive.zip', reason: 'Unzip the archive and upload its files instead.' },
		{ filename: 'big.md', reason: 'Exceeds the 100 MB per-file limit.' },
		{ filename: 'image.png', reason: 'Unsupported file type.' }
	])
})

test('summarizes client and server rejections together without discarding accepted files', () => {
	const clientSkipped = [{ filename: 'archive.zip', reason: 'Unzip the archive and upload its files instead.' }]
	const result = {
		imported: [{ path: 'ok.csv', size: 1, fileId: 'f1' }],
		skipped: [{ path: 'duplicate.csv', reason: 'Already exists' }]
	}
	expect(getProjectUploadFeedback(clientSkipped, [ok, duplicate], { result })).toEqual({
		added: 1,
		skipped: [...clientSkipped, { filename: 'duplicate.csv', reason: 'Already exists' }]
	})
})

test("a refused project upload shows the route's reason on every sent file", () => {
	const error = new LlamaAITransportError('Project storage quota exceeded', 413, {
		error: 'Project storage quota exceeded'
	})
	expect(getProjectUploadFeedback([], [ok], { error })).toEqual({
		added: 0,
		skipped: [{ filename: 'ok.csv', reason: 'Project storage quota exceeded' }]
	})
})

test('a failed project upload rejects every sent file without the raw transport text', () => {
	for (const error of [
		new TypeError('Failed to fetch'),
		new LlamaAITransportError('Failed to upload files', 500, null)
	]) {
		const { skipped } = getProjectUploadFeedback([], [ok], { error })
		expect(skipped).toHaveLength(1)
		expect(skipped[0].reason).not.toMatch(/Failed to/)
	}
})
