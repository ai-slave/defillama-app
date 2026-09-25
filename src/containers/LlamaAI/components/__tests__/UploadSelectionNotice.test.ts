import { expect, test } from 'vitest'
import { formatUploadSelectionSummary } from '../UploadSelectionNotice'

const archive = { filename: 'archive.zip', reason: 'Unzip first.' }

test.each([
	{ added: 1, skipped: [], summary: '1 file added' },
	{ added: 2, skipped: [], summary: '2 files added' },
	{ added: 1, skipped: [archive, archive], summary: '1 file added · 2 skipped' },
	{ added: 0, skipped: [archive], summary: '0 files added · 1 skipped' }
])('summarizes $added added and $skipped.length skipped as "$summary"', ({ added, skipped, summary }) => {
	expect(formatUploadSelectionSummary({ added, skipped })).toBe(summary)
})
