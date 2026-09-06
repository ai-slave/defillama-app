import { YIELDS_SNAPSHOT_FILES } from '~/containers/Yields/data/snapshot.contract'

/**
 * Pure snapshot metadata contract shared by builders and server readers.
 *
 * The version is bumped only when the on-storage layout or manifest shape is
 * incompatible. Domain schema versions change independently.
 */
export const DATASET_SNAPSHOT_FORMAT_VERSION = 2

export class DatasetSnapshotCompatibilityError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'DatasetSnapshotCompatibilityError'
	}
}

export type DatasetSnapshotDomainContract = {
	schemaVersion: number
	files: Readonly<Record<string, string>>
	optionalShardDirs?: Readonly<Record<string, string>>
}

export const DATASET_SNAPSHOT_CONTRACT = {
	yields: {
		schemaVersion: 3,
		files: YIELDS_SNAPSHOT_FILES
	},
	'token-rights': {
		schemaVersion: 1,
		files: {
			full: 'full.json',
			byDefillamaId: 'by-defillama-id.json',
			byProtocolName: 'by-protocol-name.json'
		}
	},
	risk: {
		schemaVersion: 1,
		files: {
			indexed: 'indexed.json'
		}
	},
	raises: {
		schemaVersion: 1,
		files: {
			full: 'full.json'
		}
	},
	treasuries: {
		schemaVersion: 1,
		files: {
			full: 'full.json'
		}
	},
	liquidations: {
		schemaVersion: 1,
		files: {
			rawProtocols: 'raw/protocols.json',
			rawAll: 'raw/all.json',
			rawBlockExplorers: 'raw/block-explorers.json'
		}
	},
	markets: {
		schemaVersion: 3,
		files: {
			tokensList: 'tokens-list.json',
			exchangeDirectory: 'exchange-directory.json',
			tokenGeckoIds: 'token-gecko-ids.json',
			cexByDefillamaSlug: 'cex-by-defillama-slug.json'
		}
	}
} as const satisfies Record<string, DatasetSnapshotDomainContract>

export type DatasetSnapshotDomain = keyof typeof DATASET_SNAPSHOT_CONTRACT

export const DATASET_SNAPSHOT_DOMAINS = Object.keys(DATASET_SNAPSHOT_CONTRACT) as Array<DatasetSnapshotDomain>

export type DatasetSnapshotRef = {
	domain: DatasetSnapshotDomain
	snapshotId: string
	formatVersion: typeof DATASET_SNAPSHOT_FORMAT_VERSION
	schemaVersion: number
	createdAt: number
}

export type DatasetSnapshotManifest = DatasetSnapshotRef

export type DatasetSnapshotPointer = {
	formatVersion: typeof DATASET_SNAPSHOT_FORMAT_VERSION
	domain: DatasetSnapshotDomain
	snapshotId: string
}

export function createDatasetSnapshotManifest(
	domain: DatasetSnapshotDomain,
	snapshotId: string,
	createdAt = Date.now()
): DatasetSnapshotManifest {
	return {
		domain,
		snapshotId,
		formatVersion: DATASET_SNAPSHOT_FORMAT_VERSION,
		schemaVersion: DATASET_SNAPSHOT_CONTRACT[domain].schemaVersion,
		createdAt
	}
}

export function createDatasetSnapshotPointer(ref: DatasetSnapshotRef): DatasetSnapshotPointer {
	return {
		formatVersion: DATASET_SNAPSHOT_FORMAT_VERSION,
		domain: ref.domain,
		snapshotId: ref.snapshotId
	}
}

function readObject(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Dataset snapshot ${name} must be an object`)
	}
	return value as Record<string, unknown>
}

function parseDomain(value: unknown): DatasetSnapshotDomain {
	if (typeof value !== 'string' || !(value in DATASET_SNAPSHOT_CONTRACT)) {
		throw new Error(`Dataset snapshot has unknown domain: ${String(value)}`)
	}
	return value as DatasetSnapshotDomain
}

function parseSnapshotId(value: unknown): string {
	if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) {
		throw new Error('Dataset snapshot has invalid snapshotId')
	}
	return value
}

function assertFormatVersion(value: unknown): void {
	if (value === DATASET_SNAPSHOT_FORMAT_VERSION) return
	if (typeof value === 'number' && value < DATASET_SNAPSHOT_FORMAT_VERSION) {
		throw new DatasetSnapshotCompatibilityError(
			`Dataset snapshot format mismatch: expected ${DATASET_SNAPSHOT_FORMAT_VERSION}, got ${String(value)}`
		)
	}
	throw new Error(
		`Dataset snapshot format is unsupported by this process: expected ${DATASET_SNAPSHOT_FORMAT_VERSION}, got ${String(value)}`
	)
}

export function parseDatasetSnapshotManifest(value: unknown): DatasetSnapshotManifest {
	const raw = readObject(value, 'manifest')
	assertFormatVersion(raw.formatVersion)
	const domain = parseDomain(raw.domain)
	const snapshotId = parseSnapshotId(raw.snapshotId)
	const expectedSchemaVersion = DATASET_SNAPSHOT_CONTRACT[domain].schemaVersion
	if (raw.schemaVersion !== expectedSchemaVersion) {
		const message = `Dataset snapshot schema mismatch for ${domain}: expected ${expectedSchemaVersion}, got ${String(raw.schemaVersion)}`
		if (typeof raw.schemaVersion === 'number' && raw.schemaVersion < expectedSchemaVersion) {
			throw new DatasetSnapshotCompatibilityError(message)
		}
		throw new Error(`${message}; this process cannot replace a newer or invalid schema`)
	}
	if (typeof raw.createdAt !== 'number' || !Number.isFinite(raw.createdAt) || raw.createdAt <= 0) {
		throw new Error('Dataset snapshot manifest has invalid createdAt')
	}

	return {
		domain,
		snapshotId,
		formatVersion: DATASET_SNAPSHOT_FORMAT_VERSION,
		schemaVersion: expectedSchemaVersion,
		createdAt: raw.createdAt
	}
}

export function parseDatasetSnapshotPointer(value: unknown): DatasetSnapshotPointer {
	const raw = readObject(value, 'current pointer')
	assertFormatVersion(raw.formatVersion)
	return {
		formatVersion: DATASET_SNAPSHOT_FORMAT_VERSION,
		domain: parseDomain(raw.domain),
		snapshotId: parseSnapshotId(raw.snapshotId)
	}
}
