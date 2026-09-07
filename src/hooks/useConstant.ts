import { useState } from 'react'

/**
 * Creates a value once per component instance and never replaces it.
 *
 * The obvious spelling of this is a ref assigned during render (`ref.current ??= create()`), but that
 * reads a ref during render, which React Compiler refuses to optimize — it bails out of the whole
 * component. `useMemo` compiles, but React is allowed to discard a memoized value and recompute it,
 * which would quietly replace something like an abort scope while work is still registered against it.
 * State is the primitive that actually promises one value for the life of the component.
 */
export function useConstant<T>(create: () => T): T {
	// The setter is deliberately unused: replacing the value is exactly what this hook rules out.
	// oxlint-disable-next-line react/hook-use-state -- see above
	const [value] = useState(create)
	return value
}
