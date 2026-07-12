import { createRedactedConsoleLogger } from './logger'
import { runPostStartHook } from './postStartHook'

const logger = createRedactedConsoleLogger()

runPostStartHook({ logger }).catch((error) => {
	logger.log('Post-start hook failed:', error instanceof Error ? error.message : String(error))
	process.exitCode = 1
})
