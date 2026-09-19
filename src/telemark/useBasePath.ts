import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * Prefixes an app path with the site's configured base URL.
 *
 * Docusaurus Link handles this, but a programmatic history.push does not: it
 * takes the path literally, so pushing "/mechanical/module-12" lands on
 * example.com/mechanical/module-12 while the site is served from
 * example.com/telemark/. That failure is invisible in local development, where
 * the base URL is "/", and breaks every affected link in production.
 *
 * Hardcoding the prefix instead is the mirror of the same bug: it works in
 * production and breaks locally. Reading it from config is the only form that
 * is correct in both.
 */
export function useBasePath(): (path: string) => string {
  const base = useBaseUrl('/');
  return (path: string) =>
    path.startsWith('/') ? `${base.replace(/\/$/, '')}${path}` : path;
}
