import type { CoreMetadataPayload } from '../../src/utils/metadata/artifactContract'
import { loadMetadataArtifactsFromDisk } from '../../src/utils/metadata/artifacts'
import {
	getMissingMetadataArtifacts,
	hasMetadataArtifactFiles,
	readValidMetadataArtifactManifest,
	writeMetadataArtifacts,
	writeMissingMetadataStubArtifacts
} from '../../src/utils/metadata/artifactWriter'
import { getMetadataCacheDir } from '../../src/utils/metadata/config'
import { fetchCoreMetadata } from '../../src/utils/metadata/fetch'
import { isMetadataArtifactManifestFresh } from '../../src/utils/metadata/manifest'
import { shouldSkipMetadataRefresh, shouldWriteMetadataStubsOnFailure } from '../../src/utils/metadata/policy'
import type { IProtocolMetadata } from '../../src/utils/metadata/types'

type PullMetadataCommandOptions = {
	env?: NodeJS.ProcessEnv
	fetchMetadata?: (
		previousProtocolMetadata?: Readonly<Record<string, IProtocolMetadata>>
	) => Promise<CoreMetadataPayload>
	logger?: Pick<Console, 'log'>
	now?: number
	repoRoot?: string
}

export type PullMetadataCommandResult = {
	exitCode: 0 | 1
}

export async function runPullMetadataCommand({
	env = process.env,
	fetchMetadata = fetchCoreMetadata,
	logger = console,
	now = Date.now(),
	repoRoot = process.cwd()
}: PullMetadataCommandOptions = {}): Promise<PullMetadataCommandResult> {
	const cacheDir = getMetadataCacheDir(repoRoot)
	const manifest = await readValidMetadataArtifactManifest(cacheDir)
	const hasCompleteArtifacts = manifest ? await hasMetadataArtifactFiles(cacheDir, manifest) : false
	const missingArtifacts =
		manifest && !hasCompleteArtifacts ? await getMissingMetadataArtifacts(cacheDir, manifest) : []

	if (shouldSkipMetadataRefresh(env)) {
		if (manifest?.status === 'ready' && hasCompleteArtifacts) {
			logger.log('[dev:prepare] Metadata cache: no API_KEY or direct URLs in local development; using existing cache')
			return { exitCode: 0 }
		}
		if (manifest?.status === 'ready') {
			logger.log(
				`[dev:prepare] Metadata cache: no API_KEY or direct URLs and existing cache is missing ${missingArtifacts.join(', ')}; writing stubs for missing artifacts`
			)
		}
		logger.log(
			'[dev:prepare] Metadata cache: no API_KEY or direct URLs in local development; using existing cache or empty stubs'
		)
		await writeMissingMetadataStubArtifacts(cacheDir, now)
		return { exitCode: 0 }
	}

	if (isMetadataArtifactManifestFresh(manifest, now) && hasCompleteArtifacts) {
		logger.log('[dev:prepare] Metadata cache: recently refreshed; skipping pull')
		return { exitCode: 0 }
	}
	if (isMetadataArtifactManifestFresh(manifest, now)) {
		logger.log(
			`[dev:prepare] Metadata cache: manifest is fresh but missing ${missingArtifacts.join(', ')}; pulling again`
		)
	}

	try {
		const previousProtocolMetadata =
			manifest?.status === 'ready' && hasCompleteArtifacts
				? loadMetadataArtifactsFromDisk(cacheDir).payload.protocols
				: undefined
		const metadataPayload = await fetchMetadata(previousProtocolMetadata)
		await writeMetadataArtifacts(cacheDir, metadataPayload, 'ready', now)

		logger.log('[dev:prepare] Metadata cache: pulled and cached data')
		return { exitCode: 0 }
	} catch (error) {
		logger.log('[dev:prepare] Metadata cache: failed to pull data', error)

		if (shouldWriteMetadataStubsOnFailure(env)) {
			logger.log('[dev:prepare] Metadata cache: writing empty stubs so local development can proceed')
			await writeMissingMetadataStubArtifacts(cacheDir, now)
			return { exitCode: 0 }
		}

		return { exitCode: 1 }
	}
}
