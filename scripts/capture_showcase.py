#!/usr/bin/env python3
"""Recaptures the homepage showcase screenshots from the built site.

These were taken by hand the first time, so nobody could reproduce them and
nothing recorded which page each one came from. They are the only pictures on
the homepage, so they need to be regenerable when a tool changes or the theme
moves under them.

    npm run build && python3 scripts/capture_showcase.py

Pass --light to write the light-theme set instead. Playwright drives this
rather than the site's own toolchain because it is a development tool, not part
of the build, and the project has no browser automation dependency otherwise.
"""
import asyncio
import socket
import sys
import threading
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
OUT = ROOT / "static" / "img" / "showcase"
def _free_port() -> int:
    """A port nothing else holds.

    A fixed one is not safe here. Another project was already serving on the
    port this used, with a catch-all that answered 200 for every path, so the
    readiness check passed and eight screenshots were taken of somebody else's
    website before anyone looked at them.
    """
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


PORT = _free_port()
BASE = f"http://localhost:{PORT}/telemark"
THEME = "light" if "--light" in sys.argv else "dark"

# The width and height the homepage expects; every shot is written at this size.
SIZE = {"width": 1100, "height": 726}

# The third field is what to bring into frame. A tools page opens on its own
# heading with the tool a long way below the fold, so without this every
# calculator came out as the same shot of the page title.
#
# Class names are hashed per build, hence the prefix match rather than an exact
# one. WORKBENCH is the panel holding whichever tool the hash selected.
WORKBENCH = '[class*="shell_"]'

SHOTS = [
    ("slide-calculator", "/simulator#slide", WORKBENCH),
    ("cad-check", "/simulator#cad-check", WORKBENCH),
    ("arm-simulator", "/simulator#arm-sim", WORKBENCH),
    ("gear-ratio", "/simulator#gear-ratio", WORKBENCH),
    ("beam-deflection", "/simulator#deflection", WORKBENCH),
    ("weight-budget", "/simulator#weight", WORKBENCH),
    ("lesson", "/docs/unit-00/classes-and-objects", "article, main"),
    ("cad-practice", "/mechanical/module-00/design-cycle", "article, main"),
    # The full-screen simulator, which is the one that shows the 3D field, the
    # gamepad and the editor at once. The whole page is the app, so there is
    # nothing to scroll to.
    ("unit-8-2-simulator", "/simulator/unit8.2.html", "body"),
    # The two mastery challenges that drive an imported team CAD robot. They
    # load a 3D model, so they need longer to settle than a page of markup:
    # shot too early they come out as an empty field.
    # Wider than the rest, at the same aspect. The simulator lays its gamepad
    # panel out from a fixed offset, so in a 1100px window it sits on top of the
    # robot it is meant to sit beside, and the field is too short to hold the
    # model. Same picture, more room.
    ("unit-2-mastery", "/simulator/unit2.mastery.html", "body", 4200, 1.5),
    ("unit-6-mastery", "/simulator/unit6.mastery.html", "body", 4200, 1.5),
]


class PagesHandler(SimpleHTTPRequestHandler):
    """Resolves paths the way GitHub Pages does.

    Two things a plain static server gets wrong here. The site is published
    under /telemark, and `/simulator` has to resolve to `simulator.html` even
    though a `simulator/` directory sits beside it holding the standalone
    simulators. Left to itself the server returned a directory listing for the
    tools page.

    `docusaurus serve` is not the answer either: it answers a request for a
    .html file with a 301 to the site root, so a shot of the full-screen
    simulator came out as a shot of the homepage.
    """

    def translate_path(self, path: str) -> str:
        rel = unquote(path.split("?", 1)[0].split("#", 1)[0])
        if rel.startswith("/telemark"):
            rel = rel[len("/telemark") :]
        rel = rel.lstrip("/")

        target = BUILD / rel
        if target.is_file():
            return str(target)
        # A file wins over a directory of the same name, as it does on Pages.
        as_html = BUILD / f"{rel.rstrip('/')}.html"
        if rel and as_html.is_file():
            return str(as_html)
        index = target / "index.html"
        if index.is_file():
            return str(index)
        return str(target)

    def log_message(self, *args: object) -> None:  # keep the run quiet
        return


async def wait_for_server() -> None:
    for _ in range(60):
        await asyncio.sleep(0.25)
        try:
            with urllib.request.urlopen(f"{BASE}/", timeout=2) as response:
                if response.status != 200:
                    continue
                body = response.read(4096).decode("utf-8", "replace")
                if "Telemark" not in body:
                    raise RuntimeError(
                        f"something other than Telemark is serving port {PORT}"
                    )
                return
        except RuntimeError:
            raise
        except Exception:
            continue
    raise RuntimeError(f"the built site never came up on port {PORT}")


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if not (BUILD / "index.html").is_file():
        raise RuntimeError("no build to shoot; run `npm run build` first")
    server = ThreadingHTTPServer(
        ("127.0.0.1", PORT), partial(PagesHandler, directory=str(BUILD))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        await wait_for_server()
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            context = await browser.new_context(
                viewport=SIZE,
                device_scale_factor=2,
                reduced_motion="reduce",
                # Both, because the stored choice and the system preference are
                # separate paths into the same switch and either one alone has
                # been seen to leave the attribute unset before hydration.
                color_scheme=THEME,
            )
            # Docusaurus reads the stored choice before first paint, so setting
            # it here avoids capturing a flash of the other theme.
            await context.add_init_script(
                f"try {{ localStorage.setItem('theme', '{THEME}') }} catch (e) {{}}"
            )
            page = await context.new_page()
            for shot in SHOTS:
                name, url, focus = shot[0], shot[1], shot[2]
                settle = shot[3] if len(shot) > 3 else 1200
                scale = shot[4] if len(shot) > 4 else 1.0
                await page.set_viewport_size(
                    {
                        "width": round(SIZE["width"] * scale),
                        "height": round(SIZE["height"] * scale),
                    }
                )
                await page.goto(f"{BASE}{url}", wait_until="networkidle", timeout=60000)
                await page.wait_for_timeout(settle)
                title = await page.title()
                if "Telemark" not in title:
                    raise RuntimeError(
                        f"{name}: expected a Telemark page, got {title!r}"
                    )
                # The title check alone is not enough: every page here is
                # titled Telemark, so being bounced to the homepage passes it.
                landed = page.url.split("#")[0].rstrip("/")
                wanted = f"{BASE}{url}".split("#")[0].rstrip("/")
                if landed != wanted:
                    raise RuntimeError(
                        f"{name}: asked for {wanted} and landed on {landed}"
                    )
                # Assert on the pixels, not the attribute. What matters is
                # that the shot came out dark, and the attribute can lag a
                # frame behind the stylesheet that actually paints the page.
                lightness = await page.evaluate(
                    "() => { const c = getComputedStyle(document.body)"
                    ".backgroundColor.match(/\\d+/g).map(Number);"
                    " return (c[0] + c[1] + c[2]) / 3 }"
                )
                too_light = THEME == "dark" and lightness > 90
                too_dark = THEME == "light" and lightness < 160
                if too_light or too_dark:
                    raise RuntimeError(
                        f"{name}: wanted the {THEME} theme, page painted a "
                        f"background at lightness {lightness:.0f}"
                    )
                # The ask button floats over the corner of every page and is
                # chrome, not content; it should not be in eight screenshots.
                await page.add_style_tag(
                    content='[class*="askLauncher"], [class*="askPanel"]'
                    " { display: none !important }"
                )
                moved = await page.evaluate(
                    "(sel) => { const el = document.querySelector(sel);"
                    " if (!el) return false;"
                    " const top = el.getBoundingClientRect().top + window.scrollY;"
                    " window.scrollTo(0, Math.max(0, top - 16)); return true }",
                    focus,
                )
                if not moved:
                    raise RuntimeError(
                        f"{name}: nothing matched {focus!r}, so the shot would "
                        "have been of the page header instead of the tool"
                    )
                await page.wait_for_timeout(600)
                await page.screenshot(
                    path=str(OUT / f"{name}.jpg"), type="jpeg", quality=82
                )
                print(f"  {name}  {url}")
            await context.close()
            await browser.close()
    finally:
        server.shutdown()
    print(f"Wrote {len(SHOTS)} {THEME}-theme screenshots to static/img/showcase")


asyncio.run(main())
