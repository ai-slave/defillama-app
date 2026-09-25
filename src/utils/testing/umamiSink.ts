import { afterEach, beforeEach, vi } from 'vitest'

/** Capture calls to the third-party browser SDK while running the app's analytics adapter. */
export function installUmamiSink() {
	const track = vi.fn()
	let previous: Window['umami']
	beforeEach(() => {
		previous = window.umami
		track.mockReset()
		window.umami = { track, identify: vi.fn() }
	})
	afterEach(() => {
		window.umami = previous
	})
	return track
}
