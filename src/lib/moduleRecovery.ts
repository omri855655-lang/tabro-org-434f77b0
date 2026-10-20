export function isModuleLoadFailure(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : "";
  return /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}
