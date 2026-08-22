export function getOwnRegistryValue<Value>(registry: Record<string, Value>, key: string): Value | undefined {
	if (!Object.hasOwn(registry, key)) return undefined
	return registry[key]
}
