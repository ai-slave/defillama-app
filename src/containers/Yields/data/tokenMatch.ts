export type TokenMatch = 'exact' | 'contains' | 'set'
export type TokenOn = 'reference' | 'pool' | 'both'

export const TOKEN_MATCHES: readonly TokenMatch[] = ['exact', 'contains', 'set']
export const TOKEN_ONS: readonly TokenOn[] = ['reference', 'pool', 'both']
