export type TokenMatch = 'exact' | 'contains' | 'set'
export type TokenOn = 'reference' | 'pool' | 'both'

export const TOKEN_MATCHES: ReadonlyArray<TokenMatch> = ['exact', 'contains', 'set']
export const TOKEN_ONS: ReadonlyArray<TokenOn> = ['reference', 'pool', 'both']
