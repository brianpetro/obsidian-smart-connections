/**
 * Create banner comment for esbuild bundle.
 * @param {{name: string, version: string, author: string}} pkg package metadata
 * @returns {string} banner comment
 */
export function create_banner(pkg) {
  const year = new Date().getFullYear();
  return `/*! ${pkg.name} v${pkg.version} | (c) ${year} ${pkg.author} */`;
}
