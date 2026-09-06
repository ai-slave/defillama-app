import { useState, type Dispatch, type SetStateAction } from 'react'

type Fields = Record<string, unknown>

export type SameField<F extends Fields> = (key: keyof F, a: F[keyof F], b: F[keyof F]) => boolean

/**
 * Field equality for forms made of primitives, arrays of primitives and flat objects (image and file
 * metadata). Objects compare every property, so a refetch that only changes metadata counts as a change.
 */
export function sameValue<F extends Fields>(_key: keyof F, a: F[keyof F], b: F[keyof F]): boolean {
	if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, i) => value === b[i])
	if (isFlatObject(a) && isFlatObject(b)) {
		const keys = Object.keys(a)
		return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
	}
	return a === b
}

function isFlatObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Field-level three-way merge of a draft against a newer saved version of the same entity.
 * A field the user has not touched adopts the new saved value. A field the user changed keeps the edit;
 * if the saved value moved as well, the field is reported as a conflict for the form to surface.
 */
export function mergeSavedDraft<F extends Fields>(
	draft: F,
	previousSaved: F,
	nextSaved: F,
	sameField: SameField<F>
): { draft: F; conflicts: Array<keyof F> } {
	let merged = draft
	const conflicts: Array<keyof F> = []
	for (const key in nextSaved) {
		const savedChanged = !sameField(key, previousSaved[key], nextSaved[key])
		if (!savedChanged) continue
		const edited = !sameField(key, draft[key], previousSaved[key])
		if (!edited) {
			if (merged === draft) merged = { ...draft }
			merged[key] = nextSaved[key]
			continue
		}
		if (!sameField(key, draft[key], nextSaved[key])) conflicts.push(key)
	}
	return { draft: merged, conflicts }
}

/** A conflict ends for good once the draft matches the saved value: reverted, loaded, or saved and refetched. */
function openConflicts<F extends Fields>(conflicts: Array<keyof F>, draft: F, savedForm: F, sameField: SameField<F>) {
	const open = conflicts.filter((key) => !sameField(key, draft[key], savedForm[key]))
	return open.length === conflicts.length ? conflicts : open
}

type DraftState<S, F extends Fields> = {
	saved: S
	key: string | null
	savedForm: F
	draft: F
	conflicts: Array<keyof F>
}

/**
 * A form draft that starts from a saved entity and follows it:
 * a different entity (by key) replaces the draft; a refetched copy of the same entity merges field by field,
 * so unsaved edits survive background refetches and untouched fields pick up what was saved elsewhere.
 * `conflict` is true while an edited field also changed on the server and the draft still differs from it.
 * Call `acceptSaved(stored, submitted)` when a save succeeds, with what the server stored and the snapshot
 * that was sent (carry it through the mutation's variables, never read the draft at completion). Only the
 * fields in `stored` are acknowledged: those still equal to what was sent adopt the stored value (trimmed
 * text, server-filled metadata), fields edited since the save stay edits, and the stored values become the
 * baseline for later refetches. Other fields are untouched, so a single-field save keeps unrelated edits.
 */
export function useSavedDraft<S, F extends Fields>(
	saved: S,
	savedKey: string | null,
	toForm: (saved: S) => F,
	sameField: SameField<F>
) {
	const [state, setState] = useState<DraftState<S, F>>(() => {
		const form = toForm(saved)
		return { saved, key: savedKey, savedForm: form, draft: form, conflicts: [] }
	})
	let current = state
	if (saved !== state.saved) {
		const nextForm = toForm(saved)
		if (savedKey !== state.key) {
			current = { saved, key: savedKey, savedForm: nextForm, draft: nextForm, conflicts: [] }
		} else {
			const merged = mergeSavedDraft(state.draft, state.savedForm, nextForm, sameField)
			current = {
				saved,
				key: savedKey,
				savedForm: nextForm,
				draft: merged.draft,
				conflicts: openConflicts([...state.conflicts, ...merged.conflicts], merged.draft, nextForm, sameField)
			}
		}
		setState(current)
	}

	let dirty = false
	for (const key in current.savedForm) {
		if (!sameField(key, current.draft[key], current.savedForm[key])) {
			dirty = true
			break
		}
	}
	const conflict = current.conflicts.length > 0

	const setDraft: Dispatch<SetStateAction<F>> = (action) =>
		setState((prev) => {
			const draft = typeof action === 'function' ? action(prev.draft) : action
			return { ...prev, draft, conflicts: openConflicts(prev.conflicts, draft, prev.savedForm, sameField) }
		})
	const loadSaved = () => setState((prev) => ({ ...prev, draft: prev.savedForm, conflicts: [] }))
	const acceptSaved = (stored: Partial<F>, submitted: Partial<F>) =>
		setState((prev) => {
			const draft = { ...prev.draft }
			const savedForm = { ...prev.savedForm }
			for (const name in stored) {
				const key = name as keyof F
				const value = stored[key] as F[keyof F]
				savedForm[key] = value
				if (sameField(key, prev.draft[key], submitted[key] as F[keyof F])) draft[key] = value
			}
			const conflicts = prev.conflicts.filter((key) => !(key in stored))
			return { ...prev, savedForm, draft, conflicts }
		})

	return { draft: current.draft, saved: current.savedForm, dirty, conflict, setDraft, loadSaved, acceptSaved }
}

export function SavedChangedNotice({ noun, onLoadSaved }: { noun: string; onLoadSaved: () => void }) {
	return (
		<div
			role="status"
			className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-secondary"
		>
			<span>This {noun} was changed elsewhere while you were editing. Your unsaved edits are kept.</span>
			<button
				type="button"
				onClick={onLoadSaved}
				className="rounded-md border border-medium px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-link/40"
			>
				Load saved version
			</button>
		</div>
	)
}
