# Telemark dependency review — November 9, 2026

The production audit decreased from 55 affected packages (18 critical, 20 high,
13 moderate, four low) to five low-severity packages. There are no remaining
critical, high, or moderate production findings. Counts include inherited
findings in parent packages, rather than independent application defects.

Compatible lockfile fixes and Firebase 12.10.0 → 12.19.0 were followed by scoped,
exact-version overrides. The framework was not downgraded. These overrides go
beyond upstream dependency ranges; the compatibility assessment below supports
this application's tested uses and does not claim blanket upstream support.

## Scoped overrides and compatibility evidence

| Parent | Dependency | Override | Reason |
| --- | --- | --- | --- |
| @docusaurus/core | tinypool | 2.1.2 | Patches both worker-option prototype-pollution advisories. |
| copy-webpack-plugin | serialize-javascript | 7.1.4 | Patches code execution, CPU exhaustion, and function-output escaping advisories. |
| css-minimizer-webpack-plugin | serialize-javascript | 7.1.4 | Same serializer patch, exercised through real parallel CSS minification. |
| @firebase/firestore | @grpc/grpc-js | 1.14.5 | Patches unauthorized-certificate and excess error-detail advisories on the 1.14 branch. |
| express | qs | 6.16.2 | Patches query parser/stringifier denial-of-service issues within major version 6. |
| sockjs | uuid | 11.1.1 | Patches buffer bounds checks; SockJS uses only the retained CommonJS `v4()` API. |

Tinypool 2's documented breaking change is dropping Node 18. Serializer 7's
breaking change is requiring Node 20. Telemark already requires Node 24 or newer.
Docusaurus dynamically imports Tinypool, then uses its constructor, `run`,
`destroy`, worker data tuple, and worker identifier. Those usages are tested.
Serializer retains its CommonJS function interface. gRPC documents semantic
versioning for its public API; this update stays in major version 1. Firestore's
browser bundle does not use Node gRPC, while a local Node RPC round trip checks
the overridden transport. A local SockJS WebSocket echo checks the UUID update
through the consuming transport rather than only importing the package.

Primary sources reviewed:

- [Tinypool 2 release notes](https://github.com/tinylibs/tinypool/releases/tag/v2.0.0), [worker option advisory and patch](https://github.com/advisories/GHSA-85c8-ppgw-ccpr).
- [Serializer 7 release notes](https://github.com/yahoo/serialize-javascript/releases/tag/v7.0.0), [function-output escaping patch](https://github.com/advisories/GHSA-m5mm-p8h7-m29v), [current package API](https://github.com/yahoo/serialize-javascript/blob/v7.1.4/README.md).
- [gRPC public API guarantees](https://github.com/grpc/grpc-node/blob/%40grpc/grpc-js%401.14.4/packages/grpc-js/README.md), [1.14.5 security fixes](https://github.com/grpc/grpc-node/releases/tag/%40grpc%2Fgrpc-js%401.14.5).
- [qs 6.16.2 release](https://github.com/ljharb/qs/releases/tag/v6.16.2), [UUID advisory and patched versions](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Remaining finding

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
reports prototype poisoning in deepmerge 4.2.0 through 4.3.1. The advisory lists
no patched version; 4.3.1 is the current published version. The remaining five
low-severity package findings are `deepmerge`, `@svgr/plugin-svgo`,
`@svgr/webpack`, `@docusaurus/plugin-svgr`, and `@docusaurus/preset-classic`.
The dependency belongs to the SVG build pipeline. Its presence remains recorded;
this report does not dismiss the advisory based on the site's static hosting.
An unreviewed downgrade or replacement merge implementation was not applied.

## Verification

A fresh isolated `npm ci --ignore-scripts` succeeded. `npm run test:dependencies`
checks Docusaurus-style pooled workers, inherited worker-option rejection,
serializer round trips and script escaping, actual webpack copy and parallel CSS
minification, local synthetic gRPC, query parsing, and a SockJS WebSocket echo.
`npm run typecheck` and the complete `npm run test:site` suite passed.
The production build also passed with a temporary configuration enabling
Docusaurus's pooled static rendering and forcing two worker threads. That
configuration was removed after verification; normal rendering flags remain
unchanged. Compatibility checks are included in the site regression suite.

Headed Chromium checks also verified the 390 × 844 dock composer is reachable
with code context expanded, then typed and sent a question, stopped the response,
and sent a new question successfully. Synthetic authentication/answers were
limited to the explicitly labeled component fixture; real Google sign-in and
production authenticated answers remain separate acceptance checks.

Reproduce the security report with `npm audit --omit=dev`. Advisory results may
change after this dated review. Revisit overrides when upstream ranges accept
patched releases, and rerun compatibility checks before removing them.
