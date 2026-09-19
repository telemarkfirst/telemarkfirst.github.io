# Vendored React Bits components

Copied from [React Bits](https://reactbits.dev) (MIT), which is distributed to
be copied rather than installed. The published npm bundle is a single barrel
that pulls in eighteen peer dependencies, including three.js, react-three-fiber,
rapier and matter-js, to use any one component. These are copied in instead, so
the site carries what it actually uses.

## Where these come from

React Bits publishes a shadcn-compatible registry, wired up in the project's
`components.json`. There is no React Bits MCP server of its own: the docs point
at the shadcn one, aimed at the registry. To add or re-add a component:

    npx shadcn@latest view @react-bits/SpotlightCard-TS-CSS   # inspect first
    npx shadcn@latest add  @react-bits/SpotlightCard-TS-CSS

Item names are `Component-{JS|TS}-{CSS|TW}`, four variants of each of the 166
components. This site has no Tailwind, so `-CSS`. The existing copies here are
the `-JS-CSS` variants and every one of them was checked byte for byte against
the registry: only the two changes listed below differ, so the rest can be
re-pulled and diffed cleanly when upstream moves.

- `SpotlightCard` — a highlight that follows the pointer across a card.
  Restyled onto the theme tokens; the stock version hardcodes a dark surface
  and disappears on a light page.
- `CountUp` — counts a number to its value when it scrolls into view. Used on
  the lesson total, which is a real figure.

- `ClickSpark` — sparks at the pointer on click, wrapping the whole app.
- `AccordionGallery` — the panels that open the page. Five screenshots, the
  one under the pointer expanding. See below.
- `AnimatedContent` — brings the three hero screenshots in, one after the
  next, when the page opens. See below.
- `Masonry` — the homepage grid of screenshots. Pulled from the registry with
  `shadcn add`, then reworked; see below.
- `TiltedCard` — vendored and currently unused, kept for a single image where
  a gallery is too much.

Fixes applied to the copies, since they are ours once vendored:

- `SpotlightCard` hardcodes a #111 card on a #222 border and vanishes on a
  light page; its surface reads from the theme tokens.
- `CountUp` finished on the wrong number. A spring settles by approaching its
  value, so the last frame sits under the target and formats down: 173 lessons
  displayed as 172. The exact figure is written when the animation ends.
- `Aurora` and `ShinyText` are required inside BrowserOnly rather than
  imported at the top of the page. A static import is evaluated in the server
  pass even when the component only renders in the browser, and their
  stylesheet imports fail there, which broke the build outright.
- `TiltedCard` sizes its figure to a fixed 300px and places the image itself,
  so a 1600px screenshot sat across the neighbouring column. Pinned to the grid
  column and clipped, since pinning the width alone still left it proud by the
  card's own offset.
- `ClickSpark` sizes its canvas from its own wrapper, so it has to contain the
  page. Rendered as a sibling it collapsed to nothing and drew no sparks.

`SplitText` was wanted and could not be used: it depends on GSAP's SplitText
plugin, which is not free.

## Masonry, as shipped and as changed

Four things had to change before it could carry screenshots.

- It painted each tile as a `background-image` on a `div`, so the grid held no
  image at all: nothing to read out, nothing to save, nothing for a crawler.
  Tiles are now a link around a real `<img>` with alt text.
- Each tile opened `item.url` in a new tab from an `onClick` on a `div`, which
  is unreachable by keyboard and wrong for links inside the site. The tile is
  an anchor, and `LinkComponent` lets the page pass the router's Link so the
  navigation stays client-side.
- Every tile is absolutely positioned and the container was left at
  `height: 100%`, expecting the page to hardcode a height. That cannot survive
  the column count changing at a breakpoint, so the height is measured from the
  tallest column.
- The column counts were baked in at up to five, and its classes were `.list`,
  `.item-wrapper` and `.item-img`, generic enough to collide with the site's
  own. Counts are a prop and the classes are prefixed.

## AccordionGallery, as shipped and as changed

- Its panels are plain anchors, so moving between two pages of this site
  reloaded the whole of it. `LinkComponent` lets the host pass its router link.
- Hover arrived as an `onMouseEnter` prop on that panel. A router link is free
  to define its own `onMouseEnter` after spreading the props it was handed, and
  Docusaurus's does exactly that to preload the route, so the prop was dropped
  and the gallery went half dead: arrow keys moved the panels and the mouse did
  nothing. Hover is bound as a native listener now, which nothing can overwrite.
- The height was a number written to an inline style. The hero has to fit
  whatever is left above the fold, and measuring that in JS feeds back on itself
  because the hero centres its content, so a taller gallery moves its own top.
  Passing `null` hands the height to CSS, which can size it in vh without the
  loop.
- Images were eager and their alt text fell back to the visible label. They
  load lazily past the first two, and take real alt text.

Note its own stylesheet turns the row into a stacked column below 520px with
`height: auto !important`. That is right for a gallery and wrong for a hero
that has to end above the fold, so narrow screens render a plain grid instead
and never reach that rule.

## AnimatedContent, as shipped and as changed

- It reveals only from a `ScrollTrigger`, and it sets the element to
  `opacity: 0` up front. For anything already on screen when the page opens
  that is both the wrong mechanism and a dangerous one: if the trigger measures
  stale positions while the images are still loading, `onEnter` never fires and
  the content stays invisible for good. This was not hypothetical, it happened
  on the first build here, on a 1280x720 laptop and on a phone. `animateOnMount`
  plays the timeline directly and skips the trigger.
- It animates whatever the reader has asked for. It runs on the hero, so it is
  the first thing that moves on the page; under `prefers-reduced-motion` the
  content is now placed and left alone.

Note it renders with `visibility: hidden` until its effect runs, so anything
that must survive a dead script has to render outside it. The hero images do:
the animated copy is the `BrowserOnly` child and a plain one is the fallback.

## Removed, on purpose

`Aurora` and `ShinyText` were vendored, tried on the homepage and taken back
out. Both were byte for byte the upstream files, so neither failed through
being miscopied: both assume a dark page. Aurora rendered as a bounded
grey-blue rectangle over the bone background and washed out the text above it,
and ShinyText sweeps a light gradient through the glyphs, which on a light page
erases each word as the shimmer crosses it. They are one `shadcn add` away if
the page ever goes dark.

`CircularGallery` went the same way. It drew the screenshots into a WebGL
canvas, which meant the homepage carried `ogl` and still had no image on it,
and its captions were bitmap text baked into the canvas. Masonry replaced it
and `ogl` came out of the dependencies with it.
