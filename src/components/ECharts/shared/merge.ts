/** Recursively merge ECharts option objects; arrays retain the legacy concatenate behavior. */
export function mergeDeep<T>(target: T, source: unknown): T {
	if (source == null) return target
	if (Array.isArray(source) && Array.isArray(target)) return [...target, ...source] as T
	if (typeof source !== 'object') return source as T
	if (Array.isArray(source)) return source as T

	const targetRecord = target && typeof target === 'object' && !Array.isArray(target) ? target : {}
	const result: Record<string, unknown> = { ...targetRecord }
	for (const key in source) {
		if (!Object.hasOwn(source, key)) continue
		const next = source[key as keyof typeof source]
		result[key] = next && typeof next === 'object' && !Array.isArray(next) ? mergeDeep(result[key] ?? {}, next) : next
	}
	return result as T
}
