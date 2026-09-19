# Telemark: conservative homepage refinement

## Approved design direction

Mode: Redesign · Preserve. This is a homepage preview before changes to other
screens. Keep every major section in its current order, both track entry
points, the working simulator, design tools, screenshot gallery, and closing
CTAs. Preserve routes, analytics, accounts, progress, fonts, and real assets.

Design read: an FTC learning homepage for students and coaches, with a bold
split hero and practical product demonstrations. Variance 4/10, motion 1/10,
information density 6/10, asset dependence 8/10, brand fidelity 9/10. Keep the
existing section rhythm and content, reducing ornamental elements within it.

The hero introduces the product; curriculum previews help visitors choose;
the simulator, tools, and gallery demonstrate it; the closing CTAs start a
lesson. Design for phone and laptop viewing, with a calm, practical tone.

## Existing assets and tokens

- Navbar logo: `static/img/telemark_logo.png`.
- Favicon: `static/img/telemark.png`.
- Hero reels: `static/video/telemark-hero.mp4` and
  `static/video/telemark-hero-light.mp4`.
- Posters: matching `*-poster.jpg` files extracted from the existing reels.
- Simulator feature: `static/img/showcase/unit-6-mastery-homepage.png`.
- CAD feature: `static/img/showcase/cad-check.jpg`.
- Gallery: the existing 11 images listed in `SHOWCASE` in the homepage source.
- Fonts: existing Inter headings/body and JetBrains Mono code. Preserve the
  current type scale, display weight, and large two-line hero heading.
- Colors: inherit `--tm-bg`, `--tm-surface-2`, `--tm-text-strong`, and
  `--tm-text-soft`. Use the existing blue for primary actions and a small amount
  of aqua for secondary actions. Use neutral text for numbers and metadata.
- Spacing: retain the current section widths and spacing tokens.
- Corners: ordinary 6px controls and modest media corners, no pills.
- Elevation: none on informational sections. Preserve functional control edges.
- Motion: static counters/gallery, no click sparks or entrance animations.
  The original hero video remains available through native playback controls.

## Boundaries

No Tailwind, Relume rebuild, new palette, new font or artificial irregularity.
The approved homepage direction now extends to account pages, search, lesson
framing, track/unit lists and simulator shells. Preserve routes, saved data,
permissions, editor structure and instructional motion.

Continuation baseline: `/tmp/telemark-refinement/before.tar.gz`.
No commits, pushes, deployments or publishing.
