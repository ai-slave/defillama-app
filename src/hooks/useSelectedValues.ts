import * as React from 'react'

/**
 * Selection state for filter controls whose option universe can change after
 * mount (refetched or recomputed chart data). Starts with everything selected
 * and resets whenever `allValues` becomes a different array reference —
 * replacing the `key={allValues.join('|')}` remount hack, which built huge
 * strings for venues holding thousands of tokens.
 *
 * `allValues` must be referentially stable across unrelated re-renders
 * (memoized or held in state), which holds for query- and useMemo-derived
 * lists.
 */
export function useSelectedValues(allValues: string[]): [string[], React.Dispatch<React.SetStateAction<string[]>>] {
	const [selected, setSelected] = React.useState(allValues)
	const [prevAllValues, setPrevAllValues] = React.useState(allValues)
	if (prevAllValues !== allValues) {
		// react.dev "Adjusting state when a prop changes": setting state during
		// render makes React discard this pass and re-render with the reset
		// selection before committing.
		setPrevAllValues(allValues)
		setSelected(allValues)
	}
	return [prevAllValues !== allValues ? allValues : selected, setSelected]
}
