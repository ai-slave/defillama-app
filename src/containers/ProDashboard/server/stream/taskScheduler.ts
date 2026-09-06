interface PendingTask {
	run: () => Promise<void>
	resolve: () => void
	reject: (error: unknown) => void
}

export function createBoundedTaskScheduler(concurrency: number, isStopped: () => boolean) {
	let activeTaskCount = 0
	let pendingTaskIndex = 0
	const pendingTasks: Array<PendingTask> = []
	const takePendingTask = () => {
		const task = pendingTasks[pendingTaskIndex]
		if (task) {
			pendingTaskIndex += 1
			return task
		}
		pendingTasks.length = 0
		pendingTaskIndex = 0
		return undefined
	}

	const startPendingTasks = () => {
		while (activeTaskCount < concurrency) {
			const task = takePendingTask()
			if (!task) return
			if (isStopped()) {
				task.resolve()
				continue
			}

			activeTaskCount += 1
			void task
				.run()
				.then(task.resolve, task.reject)
				// oxlint-disable-next-line no-loop-func -- the closure updates the shared active-task counter when the task settles; that is the scheduler.
				.finally(() => {
					activeTaskCount -= 1
					startPendingTasks()
				})
		}
	}

	return {
		schedule(run: () => Promise<void>): Promise<void> {
			if (isStopped()) return Promise.resolve()
			return new Promise<void>((resolve, reject) => {
				pendingTasks.push({ run, resolve, reject })
				startPendingTasks()
			})
		},
		cancelPending(): void {
			let task = takePendingTask()
			while (task) {
				task.resolve()
				task = takePendingTask()
			}
		}
	}
}
