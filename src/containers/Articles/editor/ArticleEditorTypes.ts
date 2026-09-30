import type { LocalArticleDocument } from '../types'

export type ArticleFieldUpdater = <K extends keyof LocalArticleDocument>(key: K, value: LocalArticleDocument[K]) => void

export type SavePillState = 'saving' | 'saved' | 'unsaved' | 'error' | 'idle'

/** A publish attempt's outcome. `error: null` means the fields that block publishing are marked in `publishErrors`. */
export type PublishResult = { ok: true; message: string } | { ok: false; error: string | null }
