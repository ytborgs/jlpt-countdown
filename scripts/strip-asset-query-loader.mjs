/** Node loader: strip ?v=N from relative ESM imports so CI can load versioned graph. */
export async function resolve(specifier, context, nextResolve) {
  const query = specifier.indexOf('?');
  if (query >= 0 && (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:'))) {
    return nextResolve(specifier.slice(0, query), context);
  }
  return nextResolve(specifier, context);
}
