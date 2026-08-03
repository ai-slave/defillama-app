import { describe, expect, it, vi } from 'vitest'
import { createBoundedTaskScheduler } from './taskScheduler'

describe('createBoundedTaskScheduler', () => {
	it('limits active work and settles every admitted task', async () => {
		let activeTaskCount = 0
		let maximumActiveTaskCount = 0
		const releases: Array<() => void> = []
		const scheduler = createBoundedTaskScheduler(2, () => false)

		const tasks = Array.from({ length: 5 }, () =>
			scheduler.schedule(async () => {
				activeTaskCount += 1
				maximumActiveTaskCount = Math.max(maximumActiveTaskCount, activeTaskCount)
				await new Promise<void>((resolve) => releases.push(resolve))
				activeTaskCount -= 1
			})
		)

		expect(releases).toHaveLength(2)
		for (const release of releases.splice(0)) release()
		await vi.waitFor(() => expect(releases).toHaveLength(2))
		for (const release of releases.splice(0)) release()
		await vi.waitFor(() => expect(releases).toHaveLength(1))
		const releaseFinalTask = releases[0]
		if (!releaseFinalTask) throw new Error('Expected the final task to be active')
		releaseFinalTask()
		await Promise.all(tasks)

		expect(maximumActiveTaskCount).toBe(2)
		expect(activeTaskCount).toBe(0)
	})

	it('drops queued work after cancellation while allowing active work to settle', async () => {
		let stopped = false
		let startedTaskCount = 0
		const activeTask = Promise.withResolvers<void>()
		const scheduler = createBoundedTaskScheduler(1, () => stopped)
		const tasks = Array.from({ length: 3 }, () =>
			scheduler.schedule(async () => {
				startedTaskCount += 1
				await activeTask.promise
			})
		)

		expect(startedTaskCount).toBe(1)
		stopped = true
		scheduler.cancelPending()
		activeTask.resolve()
		await Promise.all(tasks)

		expect(startedTaskCount).toBe(1)
	})
})
