import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, vi } from 'vitest'

/** Load the real snapshot store against a fresh directory for each test. */
export function installSnapshotDirectory(prefix: string) {
	let directory: string
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), `${prefix}-`))
		vi.spyOn(process, 'cwd').mockReturnValue(directory)
		vi.resetModules()
	})
	afterEach(async () => {
		vi.mocked(process.cwd).mockRestore()
		await rm(directory, { recursive: true, force: true })
	})
}
