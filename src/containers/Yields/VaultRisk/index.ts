// Do not re-export `loader` here — it is the SSR-only fetch path and would be pulled into
// the client bundle; SSR imports it by its direct path instead.
export { VaultRiskSection, VaultRiskUnmapped } from './VaultRiskSection'
export type { VaultRiskData } from './types'
