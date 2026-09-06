// SSR-only loader — the single module that touches I/O. Runs inside getServerSideProps, so
// a risk-API blip must never throw: every failure path degrades to null.

import { PROTOCOL_RISK_API, VAULT_RISK_API } from '~/constants'
import { fetchJson } from '~/utils/async'
import type { ProtocolRiskFixture, VaultRiskData, VaultRiskFixture } from './types'

// Per-attempt budget: fetchJson makes up to 2 attempts and the vault + protocol fetches are
// sequential on the pool-page SSR path, so keep this tight.
const FETCH_TIMEOUT_MS = 2500

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET and unwrap the `{ data }` envelope; null on any failure. 404 is the common case and
// stays silent; `label` keeps the API key (present in pro-routed URLs) out of the log.
async function fetchData<T>(url: string, label: string): Promise<T | null> {
	try {
		const body = await fetchJson<{ data: T }>(url, { timeout: FETCH_TIMEOUT_MS })
		return body.data
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		if (!/\[404\]/.test(msg)) console.warn(`[vault-risk] fetch ${label} failed:`, msg)
		return null
	}
}

export async function loadVaultRisk(poolId: string): Promise<VaultRiskData | null> {
	if (!poolId || !UUID_RE.test(poolId)) return null

	const vault = await fetchData<VaultRiskFixture>(`${VAULT_RISK_API}/${poolId}`, 'vault-risks')
	if (!vault) return null

	const protocol = vault.protocol_id
		? await fetchData<ProtocolRiskFixture>(`${PROTOCOL_RISK_API}/${vault.protocol_id}`, 'protocol-risks')
		: null
	return { vault, protocol }
}

// Lightweight existence check for the pool-page entry link: a single vault-only fetch.
export async function hasVaultRisk(poolId: string): Promise<boolean> {
	if (!poolId || !UUID_RE.test(poolId)) return false

	const vault = await fetchData<VaultRiskFixture>(`${VAULT_RISK_API}/${poolId}`, 'vault-risks')
	return vault !== null
}
