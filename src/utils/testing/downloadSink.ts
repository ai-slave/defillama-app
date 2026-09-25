import { afterEach, beforeEach, vi } from 'vitest'

/** Capture the browser's downloaded bytes and filename without replacing CSV serialization. */
export function installDownloadSink() {
	const downloads: Array<{ filename: string; blob: Blob }> = []
	const blobs = new Map<string, Blob>()
	let restore: () => void
	beforeEach(() => {
		downloads.length = 0
		blobs.clear()
		const create = vi.spyOn(window.URL, 'createObjectURL').mockImplementation((blob: Blob) => {
			const url = `blob:test-${blobs.size}`
			blobs.set(url, blob)
			return url
		})
		const revoke = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
			const blob = blobs.get(this.href)
			if (!blob) throw new Error(`Unknown download URL ${this.href}`)
			downloads.push({ filename: this.download, blob })
		})
		restore = () => {
			create.mockRestore()
			revoke.mockRestore()
			click.mockRestore()
		}
	})
	afterEach(() => restore())
	return downloads
}
