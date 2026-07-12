import { publishDatasetSnapshots } from '~/server/datasetSnapshots/publish.server'

/** Scheduled/manual refresh entry point; uses the same atomic publisher as ISR. */

publishDatasetSnapshots().catch(() => {
	console.error('[dataset-snapshots] Scheduled refresh failed; current snapshots were preserved')
	process.exit(1)
})
