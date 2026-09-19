const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(repoRoot, process.env.TELEMARK_REDIRECT_SOURCE || 'build');
const outputRoot = path.resolve(repoRoot, process.env.TELEMARK_REDIRECT_OUTPUT || 'redirect-build');
const targetOrigin = (process.env.TELEMARK_REDIRECT_TARGET || 'https://telemarkfirst.github.io')
  .replace(/\/+$/, '');
const legacyBasePath = `/${(process.env.TELEMARK_LEGACY_BASE_PATH || 'telemark')
  .replace(/^\/+|\/+$/g, '')}`;

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function routeForHtml(relativeFile) {
  const normalized = relativeFile.replaceAll(path.sep, '/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'index.html'.length).replace(/\/$/, '')}`;
  }
  if (fs.existsSync(path.join(repoRoot, 'static', normalized))) return `/${normalized}`;
  return `/${normalized.slice(0, -'.html'.length)}`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderRedirectPage(target) {
  const safeTarget = escapeHtml(target);
  const scriptTarget = JSON.stringify(target);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Telemark has moved</title>
  <link rel="canonical" href="${safeTarget}">
  <script>
    (function () {
      var target = ${scriptTarget};
      window.location.replace(target + window.location.search + window.location.hash);
    }());
  </script>
  <meta http-equiv="refresh" content="0; url=${safeTarget}">
</head>
<body>
  <main>
    <h1>Telemark has moved</h1>
    <p><a href="${safeTarget}">Continue to the new page</a>.</p>
  </main>
</body>
</html>
`;
}

function renderNotFoundPage() {
  const originJson = JSON.stringify(targetOrigin);
  const baseJson = JSON.stringify(legacyBasePath);
  const fallback = `${targetOrigin}/`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Telemark has moved</title>
  <script>
    (function () {
      var origin = ${originJson};
      var legacyBase = ${baseJson};
      var pathname = window.location.pathname;
      if (pathname === legacyBase) pathname = "/";
      else if (pathname.indexOf(legacyBase + "/") === 0) pathname = pathname.slice(legacyBase.length);
      if (pathname.charAt(0) !== "/") pathname = "/" + pathname;
      var target = origin + pathname;
      var canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = target;
      document.head.appendChild(canonical);
      window.location.replace(target + window.location.search + window.location.hash);
    }());
  </script>
  <noscript><meta http-equiv="refresh" content="0; url=${escapeHtml(fallback)}"></noscript>
</head>
<body>
  <main>
    <h1>Telemark has moved</h1>
    <p><a href="${escapeHtml(fallback)}">Continue to the new site</a>.</p>
  </main>
</body>
</html>
`;
}

function buildRedirectSite() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Missing Docusaurus build directory: ${sourceRoot}`);
  }
  const htmlFiles = walk(sourceRoot).filter((file) => file.endsWith('.html'));
  if (!htmlFiles.length) throw new Error('The Docusaurus build contains no HTML routes.');

  fs.rmSync(outputRoot, {recursive: true, force: true});
  fs.mkdirSync(outputRoot, {recursive: true});
  for (const sourceFile of htmlFiles) {
    const relativeFile = path.relative(sourceRoot, sourceFile);
    const destination = path.join(outputRoot, relativeFile);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    const page = relativeFile.replaceAll(path.sep, '/') === '404.html'
      ? renderNotFoundPage()
      : renderRedirectPage(`${targetOrigin}${routeForHtml(relativeFile)}`);
    fs.writeFileSync(destination, page);
  }

  fs.writeFileSync(path.join(outputRoot, '.nojekyll'), '');
  const buildMeta = path.join(sourceRoot, 'build-meta.json');
  if (fs.existsSync(buildMeta)) fs.copyFileSync(buildMeta, path.join(outputRoot, 'build-meta.json'));
  console.log(`Generated ${htmlFiles.length} redirect pages in ${path.relative(repoRoot, outputRoot)}`);
}

if (require.main === module) buildRedirectSite();

module.exports = {
  buildRedirectSite,
  legacyBasePath,
  outputRoot,
  renderNotFoundPage,
  renderRedirectPage,
  routeForHtml,
  sourceRoot,
  targetOrigin,
  walk,
};
