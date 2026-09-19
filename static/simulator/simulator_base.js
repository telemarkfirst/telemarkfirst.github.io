/**
 * ============================================================================
 * SIMULATOR_BASE.JS — FTC Java Curriculum Simulator Base
 * ============================================================================
 * 
 * A completely self-contained base template for FTC robotics curriculum
 * simulator challenges (Units 8 and 9). This file:
 * 
 *   1. Injects a complete dark-theme CSS stylesheet
 *   2. Builds the entire DOM layout (left panel, right panel, gamepad card)
 *   3. Loads external dependencies (Prism.js, Three.js, fonts)
 *   4. Provides a Prism-highlighted code editor with synchronized scrolling
 *   5. Provides a telemetry panel matching FTC Driver Station style
 *   6. Provides a floating, draggable, resizable, collapsible gamepad card
 *   7. Provides a mini Java-to-JS transpiler with safety checks
 *   8. Provides a mock hardware map registry with callbacks
 *   9. Provides a hardware badge strip
 *  10. Provides a challenge instructions panel with requirement tracking
 *  11. Provides a Three.js scene with field, walls, lights, and orbit controls
 *  12. Provides runtime utilities (getRuntime, sleep, isStopRequested, etc.)
 * 
 * Each challenge HTML file simply includes this script and defines:
 *   window.onSimulatorReady = function() { ... }
 * 
 * That callback receives no arguments and should call the exposed APIs to
 * configure the challenge (set code, register hardware, set badges, etc.)
 * 
 * ============================================================================
 */

(function () {
  "use strict";

  const THEME_MESSAGE_TYPE = "telemark:simulator-theme-state";
  const scriptMode = document.currentScript && document.currentScript.dataset
    ? document.currentScript.dataset.telemarkMode
    : "";
  const documentMode = document.documentElement && document.documentElement.dataset
    ? document.documentElement.dataset.telemarkMode
    : "";
  const simulatorMode = String(scriptMode || documentMode || "full").toLowerCase();
  const isLegacyMode = simulatorMode === "legacy";
  const themeListeners = new Set();
  let activeTheme = "";
  let legacyInstallation = null;
  const wiredGamepadCards = new WeakSet();

  function normalizeTheme(theme) {
    return theme === "light" ? "light" : "dark";
  }

  function detectInitialTheme() {
    const root = document.documentElement;
    const declared = root && (
      root.getAttribute && root.getAttribute("data-theme")
      || root.dataset && root.dataset.telemarkTheme
    );
    if (declared === "light" || declared === "dark") return declared;
    try {
      const queryTheme = new URLSearchParams(window.location.search).get("theme");
      if (queryTheme === "light" || queryTheme === "dark") return queryTheme;
    } catch (_) {}
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        const parentRoot = window.parent.document.documentElement;
        const parentTheme = parentRoot && parentRoot.getAttribute("data-theme");
        if (parentTheme === "light" || parentTheme === "dark") return parentTheme;
      }
    } catch (_) {}
    if (window.matchMedia) {
      try {
        if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
      } catch (_) {}
    }
    return "dark";
  }

  function applyTheme(theme) {
    activeTheme = normalizeTheme(theme);
    const root = document.documentElement;
    if (root) {
      if (root.setAttribute) root.setAttribute("data-theme", activeTheme);
      if (root.dataset) root.dataset.telemarkTheme = activeTheme;
      if (root.style) root.style.colorScheme = activeTheme;
    }
    if (document.body && document.body.dataset) {
      document.body.dataset.telemarkTheme = activeTheme;
    }
    const sceneContainer = document.getElementById && document.getElementById("sim-scene-container");
    if (sceneContainer && sceneContainer.style) {
      sceneContainer.style.backgroundColor = activeTheme === "light" ? "#eaf1f5" : "#050508";
    }

    applyThreeTheme(activeTheme);
    themeListeners.forEach(function (listener) {
      try {
        listener(activeTheme);
      } catch (error) {
        console.error("Telemark simulator theme callback failed", error);
      }
    });

    if (typeof window.CustomEvent === "function" && window.dispatchEvent) {
      window.dispatchEvent(new window.CustomEvent("telemark:simulator-theme-change", {
        detail: {theme: activeTheme},
      }));
    }
    return activeTheme;
  }

  function compileStudentSource(source, runtime, compileOptions) {
    if (!window.TelemarkJava || typeof window.TelemarkJava.compile !== "function") {
      throw new Error("Telemark Java compiler is unavailable");
    }
    const editor = document.getElementById("sim-code-editor") || document.getElementById("code-editor");
    const project = editor && editor.__telemarkProject;
    if (project && source === editor.value) source = project.source();
    const result = window.TelemarkJava.compile(source, runtime, compileOptions);
    if (project && project.diagnosticLocation && source === project.source()) {
      (result.diagnostics || []).forEach(function (diagnostic) {
        diagnostic.message = (diagnostic.file ? diagnostic.file + ':' + (diagnostic.line || 1) : project.diagnosticLocation(diagnostic.line || 1)) + ': ' + diagnostic.message;
      });
    }
    return result;
  }

  const managedJavaRuntimes = new Set();

  function createRuntime(options) {
    if (!window.TelemarkJava || typeof window.TelemarkJava.createRuntime !== "function") {
      throw new Error("Telemark Java runtime is unavailable");
    }
    const original = options || {};
    const settings = Object.assign({}, original, {
      onBatteryChange: function (state) {
        updateBatteryHud(state);
        if (typeof original.onBatteryChange === "function") original.onBatteryChange(state);
      },
      onBatteryWarning: function (state) {
        batteryWarning(state);
        if (typeof original.onBatteryWarning === "function") original.onBatteryWarning(state);
      },
    });
    const runtime = window.TelemarkJava.createRuntime(settings);
    managedJavaRuntimes.add(runtime);
    return runtime;
  }

  function preventNativeControllerDrag(root) {
    if (!root || !root.querySelectorAll) return;
    const images = root.querySelectorAll(
      ".controller-img, .sim-controller-img, #controller-wrap img, #sim-controller-wrap img"
    );
    Array.prototype.forEach.call(images, function (image) {
      image.draggable = false;
      if (image.setAttribute) image.setAttribute("draggable", "false");
      if (image.dataset && image.dataset.telemarkDragGuard === "true") return;
      if (image.dataset) image.dataset.telemarkDragGuard = "true";
      if (image.addEventListener) {
        image.addEventListener("dragstart", function (event) {
          event.preventDefault();
        });
      }
    });
  }

  function wireFloatingGamepadCard(card, titlebar, collapseBtn, body, resizeHandle) {
    if (!card || !titlebar || wiredGamepadCards.has(card)) return;
    wiredGamepadCards.add(card);

    let collapsed = false;
    let savedWidth = "";
    let savedHeight = "";
    let dragging = false;
    let resizing = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let previousUserSelect = "";

    function lockSelection() {
      if (!document.body || !document.body.style) return;
      previousUserSelect = document.body.style.userSelect || "";
      document.body.style.userSelect = "none";
    }

    function unlockSelection() {
      if (document.body && document.body.style) {
        document.body.style.userSelect = previousUserSelect;
      }
    }

    function finishPointer() {
      dragging = false;
      resizing = false;
      pointerId = null;
      if (titlebar.classList) titlebar.classList.remove("dragging");
      unlockSelection();
    }

    function isCollapseTarget(target) {
      if (!collapseBtn || !target) return false;
      if (target === collapseBtn) return true;
      if (typeof collapseBtn.contains === "function" && collapseBtn.contains(target)) return true;
      return typeof target.closest === "function" && target.closest("button") === collapseBtn;
    }

    if (collapseBtn && collapseBtn.addEventListener) {
      collapseBtn.addEventListener("click", function (event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        finishPointer();
        collapsed = !collapsed;
        if (card.classList) card.classList.toggle("collapsed", collapsed);
        if (collapsed) {
          savedWidth = card.style.width || "";
          savedHeight = card.style.height || "";
          if (body) body.style.display = "none";
          if (resizeHandle) resizeHandle.style.display = "none";
          card.style.height = "auto";
          collapseBtn.textContent = "+";
          collapseBtn.setAttribute("aria-expanded", "false");
        } else {
          if (body) body.style.display = "";
          if (resizeHandle) resizeHandle.style.display = "";
          card.style.width = savedWidth;
          card.style.height = savedHeight;
          collapseBtn.textContent = "−";
          collapseBtn.setAttribute("aria-expanded", "true");
        }
      });
      collapseBtn.setAttribute("aria-expanded", "true");
    }

    titlebar.addEventListener("pointerdown", function (event) {
      if (isCollapseTarget(event.target)) return;
      finishPointer();
      dragging = true;
      pointerId = event.pointerId;
      const rect = card.getBoundingClientRect();
      dragOffsetX = event.clientX - rect.left;
      dragOffsetY = event.clientY - rect.top;
      if (titlebar.classList) titlebar.classList.add("dragging");
      lockSelection();
      if (titlebar.setPointerCapture && pointerId != null) {
        try { titlebar.setPointerCapture(pointerId); } catch (_) {}
      }
      event.preventDefault();
    });
    titlebar.addEventListener("pointermove", function (event) {
      if (!dragging || (pointerId != null && event.pointerId !== pointerId)) return;
      const maxLeft = Math.max(0, window.innerWidth - card.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - Math.min(40, card.offsetHeight));
      card.style.left = Math.max(0, Math.min(maxLeft, event.clientX - dragOffsetX)) + "px";
      card.style.top = Math.max(0, Math.min(maxTop, event.clientY - dragOffsetY)) + "px";
      card.style.right = "auto";
      card.style.bottom = "auto";
      event.preventDefault();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
      titlebar.addEventListener(type, finishPointer);
    });

    if (resizeHandle && resizeHandle.addEventListener) {
      resizeHandle.addEventListener("pointerdown", function (event) {
        finishPointer();
        resizing = true;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startWidth = card.offsetWidth;
        startHeight = card.offsetHeight;
        lockSelection();
        if (resizeHandle.setPointerCapture && pointerId != null) {
          try { resizeHandle.setPointerCapture(pointerId); } catch (_) {}
        }
        event.preventDefault();
        event.stopPropagation();
      });
      resizeHandle.addEventListener("pointermove", function (event) {
        if (!resizing || (pointerId != null && event.pointerId !== pointerId)) return;
        card.style.width = Math.max(260, startWidth + event.clientX - startX) + "px";
        card.style.height = Math.max(80, startHeight + event.clientY - startY) + "px";
        event.preventDefault();
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
        resizeHandle.addEventListener(type, finishPointer);
      });
    }

    if (window.addEventListener) window.addEventListener("blur", finishPointer);
    if (card.addEventListener) {
      card.addEventListener("dragstart", function (event) { event.preventDefault(); });
      card.addEventListener("selectstart", function (event) {
        if (dragging || resizing) event.preventDefault();
      });
    }
  }

  function wireLegacyGamepadCard(settings) {
    const card = settings.card || document.querySelector("#gamepad-float-card, #gamepad-card");
    if (!card) return;
    const titlebar = settings.titlebar || card.querySelector("#gamepad-titlebar, .gamepad-titlebar");
    const collapseBtn = settings.collapseButton || card.querySelector("#gp-collapse-btn, #gamepad-collapse-btn, .gp-collapse-btn");
    const body = settings.cardBody || card.querySelector("#gamepad-card-body, #gamepad-body, .gamepad-card-body");
    const resizeHandle = settings.resizeHandle || card.querySelector("#gamepad-resize-handle, .gamepad-resize-handle");
    wireFloatingGamepadCard(card, titlebar, collapseBtn, body, resizeHandle);
  }

  function installLegacy(options) {
    const settings = options || {};
    if (typeof settings.onThemeChange === "function") {
      themeListeners.add(settings.onThemeChange);
    }

    applyTheme(activeTheme || detectInitialTheme());
    preventNativeControllerDrag(document);
    wireLegacyGamepadCard(settings);

    if (!legacyInstallation) {
      const state = settings.state || settings.gamepadState || settings.gamepad || window.gamepad || window.gamepadState;
      let controls = null;
      if (state && window.TelemarkGamepadControls) {
        controls = window.TelemarkGamepadControls.install({
          state: state,
          controller: settings.controller,
          legendContainer: settings.legendContainer,
          onInput: settings.onInput,
        });
        preventNativeControllerDrag(document);
      }
      legacyInstallation = {
        state: state || null,
        controls: controls,
        applyTheme: applyTheme,
        getTheme: function () { return activeTheme; },
        compileStudentSource: compileStudentSource,
        createRuntime: createRuntime,
        destroy: function () {
          if (controls && controls.destroy) controls.destroy();
          if (typeof settings.onThemeChange === "function") {
            themeListeners.delete(settings.onThemeChange);
          }
          legacyInstallation = null;
        },
      };
    }

    return legacyInstallation;
  }

  window.TelemarkSimulatorBase = Object.freeze({
    installLegacy: installLegacy,
    compileStudentSource: compileStudentSource,
    createRuntime: createRuntime,
    applyTheme: applyTheme,
    getTheme: function () { return activeTheme; },
    themeThreeScene: function (scene, theme) {
      return applyThreeTheme(normalizeTheme(theme || activeTheme || detectInitialTheme()), scene);
    },
    mode: simulatorMode,
  });

  window.addEventListener("message", function (event) {
    const data = event && event.data;
    if (!data || data.type !== THEME_MESSAGE_TYPE) return;
    if (data.theme !== "light" && data.theme !== "dark") return;
    applyTheme(data.theme);
  });

  // ========================================================================
  // SECTION 1: CSS THEME INJECTION
  // ========================================================================
  // Injects a complete dark-theme stylesheet into the document head.
  // Uses CSS custom properties for easy reference throughout.
  // ========================================================================

  const CSS_THEME = `
    /* ── Google Fonts ── */
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

    /* ── CSS Custom Properties ── */
    :root {
      --bg: #05080d;
      --panel: #0b1118;
      --panel-raised: #111114;
      --panel-header: #0a0a0d;
      --panel-soft: #0e0e14;
      --scene-bg: #050508;
      --code-bg: #050508;
      --border: #243746;
      --active: #22d3ee;
      --good: #22cc66;
      --warn: #ffb547;
      --danger: #cc2222;
      --text-primary: #eaf8ff;
      --text-secondary: #94a3b8;
      --font-ui: 'IBM Plex Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      --font-code: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
      --editor-line-height: 20.8px;
    }
    :root[data-theme="light"],
    :root[data-telemark-theme="light"] {
      --bg: #f4f8fb;
      --panel: #ffffff;
      --panel-raised: #f7fafc;
      --panel-header: #eef5f8;
      --panel-soft: #e8f1f5;
      --scene-bg: #eaf1f5;
      --code-bg: #f8fbfd;
      --border: #bfd0da;
      --active: #087f9c;
      --good: #168449;
      --warn: #8a5700;
      --danger: #b4232c;
      --text-primary: #102a36;
      --text-secondary: #506b78;
    }

    /* ── Scrollbar Styling ── */
    * {
      scrollbar-width: thin;
      scrollbar-color: #22d3ee #05080d;
      box-sizing: border-box;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track {
      background: #05080d;
      border-radius: 999px;
    }
    ::-webkit-scrollbar-thumb {
      background: #22d3ee;
      border: 2px solid #05080d;
      border-radius: 999px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #22d3ee;
    }
    ::-webkit-scrollbar-corner { background: #05080d; }

    /* ── Full Page Layout ── */
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg);
      color: var(--text-primary);
      font-family: var(--font-ui);
    }

    /* ── Left Panel (Editor) ── */
    #sim-left-panel {
      width: 50%;
      min-width: 320px;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--panel-raised);
      border-right: 1px solid var(--border);
    }

    /* ── Panel Header ── */
    .sim-panel-header {
      padding: 10px 14px;
      background: var(--panel-header);
      border-bottom: 1px solid var(--border);
    }
    .sim-panel-header-title {
      font-weight: 700;
      color: var(--text-primary);
      font-size: 1rem;
      font-family: var(--font-ui);
    }
    .sim-panel-header-sub {
      color: var(--text-secondary);
      font-size: 0.82rem;
      font-family: var(--font-ui);
    }

    /* ── Challenge Card ── */
    .sim-challenge-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin: 8px 10px;
      overflow: hidden;
    }
    .sim-challenge-header {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--panel-soft);
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--active);
      font-family: var(--font-ui);
      user-select: none;
    }
    .sim-challenge-header .sim-chevron {
      color: var(--text-secondary);
      font-size: 0.75rem;
      transition: transform 0.2s;
    }
    .sim-challenge-header.open .sim-chevron {
      transform: rotate(90deg);
    }
    .sim-challenge-body {
      display: none;
      padding: 10px 12px;
      font-size: 0.85rem;
      line-height: 1.6;
      color: #bbb;
      font-family: var(--font-ui);
    }
    .sim-challenge-body.open {
      display: block;
    }
    .sim-challenge-desc {
      margin: 6px 0 10px;
      color: #ddd;
      background: #0a0a0f;
      padding: 8px 10px;
      border-radius: 4px;
      font-family: var(--font-code);
      font-size: 0.82rem;
      line-height: 1.5;
    }
    .sim-fault-control {
      display: none;
      gap: 6px;
      align-items: center;
      margin: 0 0 10px;
      padding: 8px;
      border: 1px solid rgba(255, 181, 71, 0.28);
      border-radius: 4px;
      background: rgba(255, 181, 71, 0.06);
    }
    .sim-fault-control.visible {
      display: grid;
    }
    .sim-fault-control label {
      color: #ffb547;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .sim-fault-control select {
      width: 100%;
      border: 1px solid rgba(255, 181, 71, 0.35);
      border-radius: 3px;
      background: #0a0a0f;
      color: #e8f4ff;
      padding: 6px 8px;
      font: 0.78rem var(--font-ui);
    }
    .sim-fault-description {
      color: #c8b58d;
      font-size: 0.75rem;
      line-height: 1.4;
    }

    /* ── Requirements ── */
    .sim-req {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
      font-size: 0.83rem;
      font-family: var(--font-ui);
    }
    .sim-req .sim-check {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      flex-shrink: 0;
    }
    .sim-req .sim-check.pass {
      background: rgba(34, 204, 102, 0.2);
      color: var(--good);
    }
    .sim-req .sim-check.fail {
      background: rgba(100, 100, 100, 0.2);
      color: #555;
    }
    .sim-success-banner {
      display: none;
      background: rgba(34, 204, 102, 0.12);
      border: 1px solid var(--good);
      border-radius: 6px;
      padding: 10px;
      color: var(--good);
      font-weight: 700;
      font-size: 0.9rem;
      margin-top: 8px;
      text-align: center;
      font-family: var(--font-ui);
      animation: sim-banner-in 0.4s ease-out;
    }
    .sim-success-banner.visible {
      display: block;
    }
    .sim-grading-review-button {
      width: 100%;
      margin: 8px 0 0;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 5px;
      background: var(--panel-soft);
      color: var(--text-secondary);
      font: 700 0.76rem/1.2 var(--font-ui);
      cursor: pointer;
    }
    .sim-grading-review-button:hover,
    .sim-grading-review-button:focus-visible {
      border-color: var(--active);
      color: var(--active);
    }
    .sim-grading-dialog {
      width: min(680px, calc(100vw - 28px));
      max-height: min(78vh, 760px);
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--panel);
      color: var(--text-primary);
      box-shadow: 0 22px 80px rgba(0, 0, 0, 0.5);
      font-family: var(--font-ui);
    }
    .sim-grading-dialog::backdrop { background: rgba(0, 0, 0, 0.68); }
    .sim-grading-dialog-inner { padding: 18px; }
    .sim-grading-dialog h2 { margin: 0 0 5px; color: var(--active); font-size: 1.05rem; }
    .sim-grading-dialog-intro { margin: 0 0 14px; color: var(--text-secondary); font-size: 0.82rem; }
    .sim-grading-options { display: grid; gap: 9px; max-height: 50vh; overflow: auto; }
    .sim-grading-option { padding: 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--panel-soft); }
    .sim-grading-option-title { display: block; margin-bottom: 7px; font-size: 0.82rem; font-weight: 700; }
    .sim-grading-choice-row { display: flex; flex-wrap: wrap; gap: 12px; }
    .sim-grading-choice-row label { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; cursor: pointer; }
    .sim-grading-evidence { margin-top: 6px; color: var(--text-secondary); font-size: 0.73rem; }
    .sim-grading-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    .sim-grading-dialog-actions button { padding: 7px 11px; border: 1px solid var(--border); border-radius: 5px; background: var(--panel-soft); color: var(--text-primary); cursor: pointer; }
    .sim-grading-dialog-actions button:last-child { border-color: var(--active); color: var(--active); }
    @keyframes sim-banner-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Code Editor ── */
    .sim-code-wrapper {
      position: relative;
      flex: 1;
      overflow: hidden;
      background: var(--bg);
    }
    #sim-code-editor,
    #sim-highlighting {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 16px 16px 16px 56px;
      font-family: var(--font-code);
      font-size: 13px;
      line-height: var(--editor-line-height);
      tab-size: 4;
      white-space: pre;
      overflow-wrap: normal;
      word-break: normal;
      font-variant-ligatures: none;
      letter-spacing: 0;
      word-spacing: 0;
      border: 0;
      outline: none;
    }
    #sim-code-editor {
      color: transparent;
      background: transparent;
      caret-color: #fff;
      z-index: 2;
      resize: none;
      overflow: auto;
      display: block;
    }
    #sim-highlighting {
      z-index: 1;
      overflow: hidden;
      pointer-events: none;
    }
    #sim-highlighting code {
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      letter-spacing: inherit;
      word-spacing: inherit;
      white-space: pre;
      text-shadow: none;
      display: block;
      min-height: 100%;
      transform: translate(0, 0);
      will-change: transform;
    }
    /* Line numbers gutter */
    #sim-line-numbers {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 46px;
      color: #444;
      background: #0a0a0d;
      border-right: 1px solid var(--border);
      z-index: 3;
      overflow: hidden;
      user-select: none;
      pointer-events: none;
    }
    .sim-line-numbers-inner {
      padding: 16px 8px 16px 0;
      text-align: right;
      font-family: var(--font-code);
      font-size: 13px;
      line-height: var(--editor-line-height);
      letter-spacing: 0;
      min-height: 100%;
      transform: translateY(0);
    }
    .sim-line-number {
      display: block;
      height: var(--editor-line-height);
      line-height: var(--editor-line-height);
    }

    /* ── Bottom Bar ── */
    .sim-bottom-bar {
      background: var(--panel);
      border-top: 1px solid var(--border);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .sim-controls-row {
      display: flex;
      gap: 8px;
    }
    .sim-controls-row button {
      flex: 1;
      padding: 10px;
      border-radius: 6px;
      border: none;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      transition: 0.1s;
      font-family: var(--font-ui);
    }
    .sim-controls-row button:active {
      transform: translateY(1px);
    }
    .sim-btn-run { background: var(--good); }
    .sim-btn-run:hover { filter: brightness(1.1); }
    .sim-btn-run:disabled {
      background: #444;
      color: #888;
      cursor: not-allowed;
      transform: none;
    }
    .sim-btn-stop { background: var(--danger); }
    .sim-btn-stop:hover { filter: brightness(1.1); }
    .sim-btn-reset { background: #555; }
    .sim-btn-reset:hover { filter: brightness(1.2); }

    /* ── DS Status ── */
    .sim-ds-status {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-code);
      font-size: 0.85rem;
    }
    .sim-ds-state { font-weight: 700; }
    .sim-ds-readouts { display: inline-flex; align-items: center; gap: 12px; }
    .sim-ds-timer { color: #569cd6; }
    .sim-battery-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--text-secondary);
      opacity: 0.78;
      font-size: 0.76rem;
    }

    /* ── Telemetry Panel ── */
    .sim-telemetry-panel {
      background: #000;
      border: 1px solid #444;
      border-radius: 6px;
      min-height: 50px;
      max-height: 120px;
      padding: 8px;
      font-family: var(--font-code);
      font-size: 0.85rem;
      overflow-y: auto;
      color: #00ff00;
    }
    .sim-telemetry-line {
      margin: 1px 0;
    }
    .sim-telemetry-key {
      color: #4ec9b0;
    }
    .sim-telemetry-error {
      color: #ff4444;
      font-weight: 700;
    }

    /* ── Resizer ── */
    #sim-resizer {
      width: 6px;
      background: #2a2a3a;
      cursor: col-resize;
      z-index: 30;
      transition: background 0.2s;
      flex-shrink: 0;
      touch-action: none;
    }
    #sim-resizer:hover, #sim-resizer.active {
      background: var(--active);
    }

    /* ── Right Panel ── */
    #sim-right-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0a0a0d;
      min-width: 350px;
      overflow: hidden;
    }

    /* ── Badge Strip ── */
    .sim-badge-strip {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      padding: 10px 10px 0;
    }
    .sim-hw-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--border);
      font-family: var(--font-ui);
      transition: all 0.2s;
    }
    .sim-hw-badge.active {
      border-color: var(--active);
      color: var(--active);
      background: rgba(34, 211, 238, 0.1);
    }
    .sim-hw-badge.inactive {
      background: #111;
      color: #444;
      border-color: #222;
    }

    /* ── Scene Container ── */
    #sim-scene-container {
      flex: 1;
      position: relative;
      margin: 10px;
      border-radius: 8px;
      overflow: hidden;
      background: #050508;
    }
    #sim-robot-canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    #sim-robot-canvas:active { cursor: grabbing; }

    /* ── Scene Controls ── */
    .sim-scene-reset-controls {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 5;
      display: flex;
      gap: 7px;
    }
    .sim-scene-reset-btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: rgba(19, 19, 26, 0.85);
      color: var(--text-primary);
      font-family: var(--font-ui);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: 0.15s;
    }
    .sim-scene-reset-btn:hover {
      background: rgba(40, 40, 60, 0.9);
      border-color: var(--active);
      color: var(--active);
    }

    /* ── Reset Confirmation ── */
    .sim-reset-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(5px);
    }
    .sim-reset-dialog-backdrop[hidden] {
      display: none;
    }
    .sim-reset-dialog {
      width: min(420px, 100%);
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--panel);
      color: var(--text-primary);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.65);
      font-family: var(--font-ui);
    }
    .sim-reset-dialog-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin-bottom: 14px;
      border-radius: 9px;
      background: rgba(255, 181, 71, 0.12);
      color: var(--warn);
      font-size: 1rem;
    }
    .sim-reset-dialog h2 {
      margin: 0 0 8px;
      color: var(--text-primary);
      font-size: 1.05rem;
      line-height: 1.3;
    }
    .sim-reset-dialog p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.86rem;
      line-height: 1.55;
    }
    .sim-reset-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }
    .sim-reset-dialog-actions button {
      min-height: 36px;
      padding: 8px 13px;
      border: 1px solid var(--border);
      border-radius: 7px;
      font: 600 0.82rem var(--font-ui);
      cursor: pointer;
    }
    .sim-reset-dialog-cancel {
      background: transparent;
      color: var(--text-secondary);
    }
    .sim-reset-dialog-cancel:hover,
    .sim-reset-dialog-cancel:focus-visible {
      border-color: var(--active);
      color: var(--text-primary);
    }
    .sim-reset-dialog-confirm {
      border-color: var(--danger) !important;
      background: var(--danger);
      color: #fff;
    }
    .sim-reset-dialog-confirm:hover,
    .sim-reset-dialog-confirm:focus-visible {
      filter: brightness(1.12);
    }
    .sim-reset-dialog-actions button:focus-visible {
      outline: 2px solid var(--active);
      outline-offset: 2px;
    }

    /* ────────────────────────────────────────────────────────────────────────
       GAMEPAD FLOATING CARD
       ──────────────────────────────────────────────────────────────────────── */
    .sim-gamepad-card {
      position: fixed;
      bottom: 12px;
      right: 12px;
      width: 400px;
      min-width: 260px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
      overflow: hidden;
    }
    .sim-gamepad-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #0e0e14;
      border-bottom: 1px solid var(--border);
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }
    .sim-gamepad-titlebar:active { cursor: grabbing; }
    .sim-gamepad-title-label {
      font-weight: 700;
      font-size: 0.9rem;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-ui);
    }
    .sim-gamepad-title-label .sim-gp-icon {
      color: #569cd6;
    }
    .sim-gp-collapse-btn {
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 4px;
      background: #333;
      border: 1px solid #555;
      color: #ccc;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .sim-gp-collapse-btn:hover { background: #444; }

    .sim-gamepad-body {
      padding: 10px;
      overflow: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sim-gamepad-resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 16px;
      height: 16px;
      cursor: nwse-resize;
      z-index: 10;
    }
    .sim-gamepad-resize-handle::after {
      content: '';
      position: absolute;
      bottom: 3px;
      right: 3px;
      width: 6px;
      height: 6px;
      border-right: 2px solid #666;
      border-bottom: 2px solid #666;
    }

    /* ── Gamepad Layout ── */
    .sim-gp-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .sim-gp-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .sim-gp-section-label {
      font-size: 0.65rem;
      color: var(--text-secondary);
      font-family: var(--font-code);
      text-align: center;
      white-space: nowrap;
    }

    /* ── Joystick Zone ── */
    .sim-joystick-zone {
      width: 100px;
      height: 100px;
      background: #1a1a24;
      border: 1px solid var(--border);
      border-radius: 8px;
      position: relative;
      touch-action: none;
      cursor: grab;
    }
    .sim-joystick-zone:active { cursor: grabbing; }
    .sim-joystick-crosshair-h,
    .sim-joystick-crosshair-v {
      position: absolute;
      background: #222;
      pointer-events: none;
    }
    .sim-joystick-crosshair-h {
      left: 0; right: 0;
      top: 50%;
      height: 1px;
      transform: translateY(-0.5px);
    }
    .sim-joystick-crosshair-v {
      top: 0; bottom: 0;
      left: 50%;
      width: 1px;
      transform: translateX(-0.5px);
    }
    .sim-joystick-knob {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #4a4a5a, #1a1a24 70%);
      border: 2px solid rgba(255,255,255,0.15);
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: box-shadow 0.15s;
    }
    .sim-joystick-knob.active {
      box-shadow: 0 0 8px rgba(86, 156, 214, 0.5);
      border-color: rgba(86, 156, 214, 0.5);
    }
    .sim-joystick-value {
      font-size: 0.6rem;
      color: var(--text-secondary);
      font-family: var(--font-code);
      text-align: center;
      margin-top: 2px;
    }

    /* ── Trigger Slider ── */
    .sim-trigger-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .sim-trigger-slider {
      width: 30px;
      height: 80px;
      background: #1a1a24;
      border: 1px solid var(--border);
      border-radius: 6px;
      position: relative;
      cursor: pointer;
      touch-action: none;
      overflow: hidden;
    }
    .sim-trigger-fill {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, #2563eb, var(--active));
      border-radius: 0 0 5px 5px;
      transition: height 0.05s;
    }
    .sim-trigger-value {
      font-size: 0.6rem;
      color: var(--text-secondary);
      font-family: var(--font-code);
    }

    /* ── Button Grid ── */
    .sim-gp-btn-grid {
      display: grid;
      gap: 4px;
    }
    .sim-gp-btn-grid.face-buttons {
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
    }
    .sim-gp-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.15);
      background: #1a1a24;
      color: var(--text-secondary);
      font-family: var(--font-ui);
      font-weight: 700;
      font-size: 0.7rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.1s;
      user-select: none;
    }
    .sim-gp-btn:hover {
      border-color: rgba(255,255,255,0.3);
    }
    .sim-gp-btn.pressed {
      background: rgba(255,255,255,0.18);
      box-shadow: 0 0 6px rgba(255,255,255,0.25);
    }
    .sim-gp-btn.btn-a { color: #22cc66; border-color: #22cc66; }
    .sim-gp-btn.btn-a.pressed { background: rgba(34,204,102,0.3); }
    .sim-gp-btn.btn-b { color: #cc2222; border-color: #cc2222; }
    .sim-gp-btn.btn-b.pressed { background: rgba(204,34,34,0.3); }
    .sim-gp-btn.btn-x { color: #2266cc; border-color: #2266cc; }
    .sim-gp-btn.btn-x.pressed { background: rgba(34,102,204,0.3); }
    .sim-gp-btn.btn-y { color: #cccc22; border-color: #cccc22; }
    .sim-gp-btn.btn-y.pressed { background: rgba(204,204,34,0.3); }

    /* ── Bumper Buttons ── */
    .sim-gp-bumper {
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #1a1a24;
      color: var(--text-secondary);
      font-family: var(--font-code);
      font-size: 0.65rem;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s;
      text-align: center;
    }
    .sim-gp-bumper.pressed {
      background: rgba(255,255,255,0.18);
      border-color: rgba(255,255,255,0.4);
      color: #fff;
    }

    /* ── DPad ── */
    .sim-dpad-grid {
      display: grid;
      grid-template-columns: repeat(3, 28px);
      grid-template-rows: repeat(3, 28px);
      gap: 2px;
    }
    .sim-dpad-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.08);
      background: #1a1a24;
      color: var(--text-secondary);
      font-size: 0.7rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      transition: all 0.1s;
    }
    .sim-dpad-btn.pressed {
      background: rgba(255,255,255,0.18);
      border-color: rgba(255,255,255,0.3);
    }
    .sim-dpad-center {
      background: #0e0e14;
      cursor: default;
      border-color: transparent;
    }

    /* ── Small Buttons (start/back) ── */
    .sim-gp-small-btn {
      padding: 3px 10px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #1a1a24;
      color: var(--text-secondary);
      font-family: var(--font-code);
      font-size: 0.6rem;
      cursor: pointer;
      user-select: none;
      transition: all 0.1s;
    }
    .sim-gp-small-btn.pressed {
      background: rgba(255,255,255,0.18);
      border-color: rgba(255,255,255,0.3);
      color: #fff;
    }

    /* ── Greyed Out (inactive input) ── */
    .sim-gp-input-inactive {
      opacity: 0.65;
      pointer-events: auto;
    }
    .sim-gp-input-recommended {
      border-color: rgba(0,152,255,0.75) !important;
      box-shadow: 0 0 0 2px rgba(0,152,255,0.25);
      opacity: 1 !important;
    }

    /* ── Logitech Image Overlay Gamepad ── */
    .sim-controller-wrap {
      width: 100%;
      position: relative;
      aspect-ratio: 768 / 512;
      border-radius: 14px;
      overflow: hidden;
      background: #0f0f0f;
      touch-action: none;
      user-select: none;
    }
    .sim-controller-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      z-index: 1;
    }
    .sim-gp-overlay {
      position: absolute;
      z-index: 4;
      touch-action: none;
      user-select: none;
    }
    .sim-gp-overlay.button {
      border: 2px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.01);
      cursor: pointer;
      opacity: 0.45;
    }
    .sim-gp-overlay.button.pressed,
    .sim-stick-zone.active {
      background: rgba(255,255,255,0.18);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
      opacity: 1;
    }
    .sim-face-a { left:75.5%; top:49%; width:7%; height:10%; transform:translate(-10%,-10%); border-radius:50%; }
    .sim-face-b { left:83%; top:38%; width:7%; height:10%; transform:translate(-10%,-10%); border-radius:50%; }
    .sim-face-x { left:68%; top:38%; width:7%; height:10%; transform:translate(-10%,-10%); border-radius:50%; }
    .sim-face-y { left:75.5%; top:27%; width:7%; height:10%; transform:translate(-10%,-10%); border-radius:50%; }
    .sim-small-back { left:37.5%; top:28%; width:5.2%; height:6.4%; transform:translate(-10%,-10%); border-radius:16px; }
    .sim-small-start { left:58%; top:28%; width:5.2%; height:6.4%; transform:translate(-10%,-10%); border-radius:16px; }
    .sim-bumper-left { left:20%; top:12%; width:14%; height:6%; transform:translate(-50%,-50%); border-radius:8px; }
    .sim-bumper-right { left:80%; top:12%; width:14%; height:6%; transform:translate(-50%,-50%); border-radius:8px; }
    .sim-stick-zone {
      border-radius: 50%;
      background: transparent;
      cursor: grab;
    }
    .sim-stick-zone:active { cursor: grabbing; }
    .sim-stick-left { left:35.5%; top:65.5%; width:17%; height:24%; transform:translate(-50%,-50%); }
    .sim-stick-right { left:64%; top:65.5%; width:17%; height:24%; transform:translate(-50%,-50%); }
    .sim-stick-knob {
      width: 52%;
      height: 52%;
      border-radius: 50%;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle at 35% 35%, rgba(80,80,80,.75), rgba(12,12,12,.55) 70%);
      border: 1px solid rgba(255,255,255,.14);
      pointer-events: none;
      opacity: 1;
    }
    .sim-trigger-image {
      position: absolute;
      z-index: 5;
      width: 10%;
      height: 14%;
      top: 0;
      transform: translate(-50%, 0);
      background: rgba(0,0,0,.38);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.15);
      cursor: pointer;
      overflow: hidden;
      touch-action: none;
    }
    .sim-trigger-image.left { left:21%; }
    .sim-trigger-image.right { left:79%; }
    .sim-trigger-image .sim-trigger-fill {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 0%;
      background: linear-gradient(to top, #38bdf8, #22d3ee);
    }
    .sim-dpad-overlay { left:21.5%; top:41%; width:16%; height:24%; transform:translate(-50%,-50%); pointer-events:none; }
    .sim-dpad-image-btn {
      position: absolute;
      width: 33%;
      height: 33%;
      background: rgba(255,255,255,0.01);
      border: 1px solid rgba(255,255,255,0.06);
      pointer-events: auto;
      cursor: pointer;
    }
    .sim-dpad-image-btn.pressed { background: rgba(255,255,255,0.18); }
    .sim-dpad-image-up { top:0; left:33%; border-radius:4px 4px 0 0; }
    .sim-dpad-image-down { bottom:0; left:33%; border-radius:0 0 4px 4px; }
    .sim-dpad-image-left { left:0; top:33%; border-radius:4px 0 0 4px; }
    .sim-dpad-image-right { right:0; top:33%; border-radius:0 4px 4px 0; }

    /* ── Hint Container ── */
    #sim-hint-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 150px;
      overflow: auto;
    }
    .sim-hint {
      background: rgba(255,204,0,0.12);
      border-left: 3px solid #ffcc00;
      padding: 6px 8px;
      color: #ffcc00;
      border-radius: 3px;
      font-size: 0.82rem;
      font-family: var(--font-ui);
    }
    .sim-hint.error {
      background: rgba(204,0,0,0.12);
      border-left-color: var(--danger);
      color: #ff6666;
    }
    .sim-hint.info {
      background: rgba(0,122,204,0.12);
      border-left-color: #38bdf8;
      color: #6db3f2;
    }

    :root[data-theme="light"] body,
    :root[data-telemark-theme="light"] body {
      background: var(--bg);
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-challenge-body,
    :root[data-telemark-theme="light"] .sim-challenge-body,
    :root[data-theme="light"] .sim-challenge-desc,
    :root[data-telemark-theme="light"] .sim-challenge-desc {
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-challenge-desc,
    :root[data-telemark-theme="light"] .sim-challenge-desc,
    :root[data-theme="light"] .sim-fault-control select,
    :root[data-telemark-theme="light"] .sim-fault-control select {
      background: var(--code-bg);
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-code-wrapper,
    :root[data-telemark-theme="light"] .sim-code-wrapper,
    :root[data-theme="light"] #sim-highlighting,
    :root[data-telemark-theme="light"] #sim-highlighting {
      background: var(--code-bg);
    }
    :root[data-theme="light"] #sim-code-editor,
    :root[data-telemark-theme="light"] #sim-code-editor {
      caret-color: #102a36;
    }
    :root[data-theme="light"] .sim-bottom-bar,
    :root[data-telemark-theme="light"] .sim-bottom-bar,
    :root[data-theme="light"] #sim-right-panel,
    :root[data-telemark-theme="light"] #sim-right-panel,
    :root[data-theme="light"] .sim-gamepad-card,
    :root[data-telemark-theme="light"] .sim-gamepad-card {
      background: var(--panel);
    }
    :root[data-theme="light"] .sim-gamepad-titlebar,
    :root[data-telemark-theme="light"] .sim-gamepad-titlebar {
      background: var(--panel-soft);
    }
    :root[data-theme="light"] .sim-gamepad-title-label,
    :root[data-telemark-theme="light"] .sim-gamepad-title-label {
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-gp-collapse-btn,
    :root[data-telemark-theme="light"] .sim-gp-collapse-btn {
      background: #ffffff;
      border-color: var(--border);
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-controller-wrap,
    :root[data-telemark-theme="light"] .sim-controller-wrap,
    :root[data-theme="light"] #sim-scene-container,
    :root[data-telemark-theme="light"] #sim-scene-container {
      background: var(--scene-bg);
    }
    :root[data-theme="light"] .sim-controls-row .sim-btn-reset,
    :root[data-telemark-theme="light"] .sim-controls-row .sim-btn-reset {
      background: var(--panel-soft);
      border: 1px solid var(--border);
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-controls-row .sim-btn-reset:hover,
    :root[data-telemark-theme="light"] .sim-controls-row .sim-btn-reset:hover {
      background: var(--panel-raised);
      border-color: var(--active);
      color: var(--text-primary);
      filter: none;
    }
    :root[data-theme="light"] .sim-scene-reset-btn,
    :root[data-telemark-theme="light"] .sim-scene-reset-btn {
      background: rgba(255, 255, 255, 0.92);
      border-color: var(--border);
      color: var(--text-primary);
    }
    :root[data-theme="light"] .sim-scene-reset-btn:hover,
    :root[data-telemark-theme="light"] .sim-scene-reset-btn:hover {
      background: #ffffff;
      border-color: var(--active);
      color: var(--active);
    }
    :root[data-theme="light"] .sim-reset-dialog,
    :root[data-telemark-theme="light"] .sim-reset-dialog {
      background: #ffffff;
      border-color: var(--border);
      color: var(--text-primary);
      box-shadow: 0 24px 70px rgba(16, 42, 54, 0.25);
    }
    :root[data-theme="light"] .sim-telemetry-panel,
    :root[data-telemark-theme="light"] .sim-telemetry-panel {
      background: #102229;
      color: #8df3ad;
    }

    @media (max-width: 900px) {
      #sim-left-panel {
        flex: 1 1 auto;
        width: auto !important;
        min-width: 0;
        height: 100%;
        border-right: 1px solid var(--border);
        border-bottom: none;
      }
      #sim-right-panel {
        flex: 0 0 clamp(260px, 34vw, 330px);
        width: clamp(260px, 34vw, 330px);
        min-width: 260px;
        height: 100%;
      }
      .sim-panel-header {
        padding: 8px 12px;
      }
      .sim-challenge-card {
        margin: 6px 8px;
      }
      .sim-challenge-body {
        max-height: 130px;
        overflow: auto;
      }
      .sim-code-wrapper {
        min-height: 210px;
      }
      .sim-bottom-bar {
        padding: 8px;
        gap: 6px;
      }
      .sim-telemetry-panel {
        max-height: 96px;
      }
      .sim-badge-strip {
        padding: 6px 8px;
        gap: 6px;
        flex-wrap: wrap;
      }
      #sim-scene-container {
        margin: 8px;
        flex: 0 0 auto;
        width: calc(100% - 16px);
        aspect-ratio: 1 / 1;
        min-height: 0;
      }
      .sim-gamepad-card {
        width: min(330px, calc(100vw - 24px));
        right: 8px;
        bottom: 8px;
      }
    }

    @media (max-width: 640px) {
      body {
        flex-direction: column;
      }
      #sim-left-panel {
        width: 100% !important;
        height: 62%;
        border-right: none;
        border-bottom: 1px solid var(--border);
      }
      #sim-resizer {
        display: none;
      }
      #sim-right-panel {
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        height: 38%;
        min-height: 260px;
      }
      #sim-scene-container {
        flex: 1 1 auto;
        width: auto;
        aspect-ratio: auto;
      }
    }
  `;

  function injectCSS() {
    const style = document.createElement("style");
    style.id = "sim-base-theme";
    style.textContent = CSS_THEME;
    document.head.appendChild(style);
  }

  // ========================================================================
  // SECTION 2: DOM CONSTRUCTION
  // ========================================================================
  // Builds the entire page layout from scratch. Each challenge HTML can be
  // a minimal shell that just loads this script.
  // ========================================================================

  function buildDOM() {
    document.body.innerHTML = "";

    // ── Left Panel ──
    const leftPanel = el("div", { id: "sim-left-panel" });

    // Panel header
    const panelHeader = el("div", { className: "sim-panel-header" });
    panelHeader.appendChild(
      el("div", { className: "sim-panel-header-title", id: "sim-header-title" })
    );
    panelHeader.appendChild(
      el("div", { className: "sim-panel-header-sub", id: "sim-header-sub" })
    );
    leftPanel.appendChild(panelHeader);

    // Challenge card
    const challengeCard = el("div", {
      className: "sim-challenge-card",
      id: "sim-challenge-card",
    });

    const challengeHeader = el("div", {
      className: "sim-challenge-header open",
      id: "sim-challenge-header",
    });
    challengeHeader.innerHTML = `<span id="sim-challenge-title-text"></span><span class="sim-chevron">&#9654;</span>`;
    challengeHeader.addEventListener("click", function () {
      this.classList.toggle("open");
      document.getElementById("sim-challenge-body").classList.toggle("open");
    });
    challengeCard.appendChild(challengeHeader);

    const challengeBody = el("div", {
      className: "sim-challenge-body open",
      id: "sim-challenge-body",
    });
    challengeBody.innerHTML = `
      <div class="sim-challenge-desc" id="sim-challenge-desc"></div>
      <div class="sim-fault-control" id="sim-fault-control">
        <label for="sim-fault-select">Optional robot fault</label>
        <select id="sim-fault-select"></select>
        <div class="sim-fault-description" id="sim-fault-description"></div>
      </div>
      <div id="sim-requirements-list"></div>
      <button type="button" class="sim-grading-review-button" id="sim-grading-review-button">Review grading</button>
      <div class="sim-success-banner" id="sim-success-banner"><i class="fa-solid fa-circle-check"></i> Challenge Complete!</div>
    `;
    challengeCard.appendChild(challengeBody);
    leftPanel.appendChild(challengeCard);

    // Code editor
    const codeWrapper = el("div", { className: "sim-code-wrapper" });
    const lineNumbers = el("div", { id: "sim-line-numbers" });
    codeWrapper.appendChild(lineNumbers);
    const codeEditor = el("textarea", {
      id: "sim-code-editor",
      spellcheck: false,
    });
    codeEditor.setAttribute("wrap", "off");
    codeWrapper.appendChild(codeEditor);
    const highlighting = el("pre", { id: "sim-highlighting" });
    highlighting.setAttribute("aria-hidden", "true");
    highlighting.innerHTML = `<code class="language-java" id="sim-highlighting-content"></code>`;
    codeWrapper.appendChild(highlighting);
    leftPanel.appendChild(codeWrapper);

    // Bottom bar
    const bottomBar = el("div", { className: "sim-bottom-bar" });

    const controlsRow = el("div", { className: "sim-controls-row" });
    const btnRun = el("button", {
      className: "sim-btn-run",
      id: "sim-btn-run",
    });
    btnRun.innerHTML = "Init";
    const btnStop = el("button", {
      className: "sim-btn-stop",
      id: "sim-btn-stop",
    });
    btnStop.innerHTML = "&#9632; Stop";
    controlsRow.appendChild(btnRun);
    controlsRow.appendChild(btnStop);
    bottomBar.appendChild(controlsRow);

    const dsStatus = el("div", { className: "sim-ds-status" });
    dsStatus.innerHTML = `
      <span class="sim-ds-state" id="sim-ds-state" style="color:var(--danger)">STOPPED</span>
      <span class="sim-ds-readouts">
        <span class="sim-battery-status" title="Simulated robot battery"><i class="fa-solid fa-battery-three-quarters" aria-hidden="true"></i><span id="sim-battery-voltage">13.00</span> V</span>
        <span class="sim-ds-timer">Time: <span id="sim-timer-val">0.00</span>s</span>
      </span>
    `;
    bottomBar.appendChild(dsStatus);

    const telPanel = el("div", {
      className: "sim-telemetry-panel",
      id: "sim-telemetry-log",
    });
    telPanel.innerHTML = `<span style="color:#666">Press Init to initialize...</span>`;
    bottomBar.appendChild(telPanel);

    const hintContainer = el("div", { id: "sim-hint-container" });
    bottomBar.appendChild(hintContainer);

    leftPanel.appendChild(bottomBar);
    document.body.appendChild(leftPanel);

    // ── Resizer ──
    const resizer = el("div", { id: "sim-resizer" });
    document.body.appendChild(resizer);

    // ── Right Panel ──
    const rightPanel = el("div", { id: "sim-right-panel" });

    const badgeStrip = el("div", {
      className: "sim-badge-strip",
      id: "sim-badge-strip",
    });
    rightPanel.appendChild(badgeStrip);

    const sceneContainer = el("div", { id: "sim-scene-container" });
    const canvas = el("canvas", { id: "sim-robot-canvas" });
    sceneContainer.appendChild(canvas);
    // Robot and source resets are deliberately separate: one restores the
    // scene immediately, while the destructive source reset requires the
    // confirmation card below.
    const resetControls = el("div", {className: "sim-scene-reset-controls"});
    const robotResetBtn = el("button", {
      className: "sim-scene-reset-btn",
      id: "sim-scene-reset-btn",
    });
    robotResetBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Reset robot';
    robotResetBtn.addEventListener("click", function () {
      handleStop();
      // Mastery robots are driven from a persistent motion model. Reset that
      // model—not only the Three.js group—or animation would immediately move
      // the robot back to its previous field coordinates.
      if (
        window.__telemarkMasteryMotion &&
        typeof window.__telemarkMasteryMotion.resetPose === "function"
      ) {
        window.__telemarkMasteryMotion.resetPose();
      }
      if (typeof window.onReset === "function") window.onReset();
    });
    resetControls.appendChild(robotResetBtn);

    const codeResetBtn = el("button", {
      className: "sim-scene-reset-btn",
      id: "sim-code-reset-btn",
    });
    codeResetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset code';
    resetControls.appendChild(codeResetBtn);
    sceneContainer.appendChild(resetControls);
    rightPanel.appendChild(sceneContainer);

    document.body.appendChild(rightPanel);

    // A simulator-native confirmation card keeps the destructive code reset
    // visually consistent and gives keyboard users a safe Cancel-first flow.
    const resetDialogBackdrop = el("div", {
      className: "sim-reset-dialog-backdrop",
      id: "sim-reset-dialog-backdrop",
    });
    resetDialogBackdrop.hidden = true;
    resetDialogBackdrop.setAttribute("aria-hidden", "true");

    const resetDialog = el("div", {className: "sim-reset-dialog"});
    resetDialog.setAttribute("role", "dialog");
    resetDialog.setAttribute("aria-modal", "true");
    resetDialog.setAttribute("aria-labelledby", "sim-reset-dialog-title");
    resetDialog.setAttribute("aria-describedby", "sim-reset-dialog-description");
    resetDialog.innerHTML = `
      <span class="sim-reset-dialog-icon" aria-hidden="true"><i class="fa-solid fa-rotate-left"></i></span>
      <h2 id="sim-reset-dialog-title">Restore starter code?</h2>
      <p id="sim-reset-dialog-description">This will stop the simulator and replace your current code with the lesson's original starter code.</p>
      <div class="sim-reset-dialog-actions">
        <button type="button" class="sim-reset-dialog-cancel">Cancel</button>
        <button type="button" class="sim-reset-dialog-confirm">Restore starter code</button>
      </div>
    `;
    resetDialogBackdrop.appendChild(resetDialog);
    document.body.appendChild(resetDialogBackdrop);

    const resetCancelBtn = resetDialog.querySelector(".sim-reset-dialog-cancel");
    const resetConfirmBtn = resetDialog.querySelector(".sim-reset-dialog-confirm");
    let resetDialogReturnFocus = null;

    function closeResetDialog() {
      resetDialogBackdrop.hidden = true;
      resetDialogBackdrop.setAttribute("aria-hidden", "true");
      if (resetDialogReturnFocus && typeof resetDialogReturnFocus.focus === "function") {
        resetDialogReturnFocus.focus();
      }
      resetDialogReturnFocus = null;
    }

    function openResetDialog() {
      resetDialogReturnFocus = document.activeElement;
      resetDialogBackdrop.hidden = false;
      resetDialogBackdrop.setAttribute("aria-hidden", "false");
      resetCancelBtn.focus();
    }

    codeResetBtn.addEventListener("click", openResetDialog);
    resetCancelBtn.addEventListener("click", closeResetDialog);
    resetConfirmBtn.addEventListener("click", function () {
      closeResetDialog();
      handleStop();
      window.resetCodeToStarter();
      if (typeof window.onReset === "function") window.onReset();
    });
    resetDialogBackdrop.addEventListener("click", function (event) {
      if (event.target === resetDialogBackdrop) closeResetDialog();
    });
    resetDialogBackdrop.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeResetDialog();
        return;
      }
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === resetCancelBtn) {
        event.preventDefault();
        resetConfirmBtn.focus();
      } else if (!event.shiftKey && document.activeElement === resetConfirmBtn) {
        event.preventDefault();
        resetCancelBtn.focus();
      }
    });

    // ── Gamepad Card ──
    buildGamepadCard();
    if (window.TelemarkGamepadControls) {
      window.telemarkGamepadControls = window.TelemarkGamepadControls.install({
        state: window.gamepad,
        pointer: false,
      });
    }
    preventNativeControllerDrag(document);

    // ── Wire up events ──
    wireEditorEvents();
    wireResizerEvents();
    wireRunStopEvents();
  }

  /** Helper: create an element with properties */
  function el(tag, props) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === "className") e.className = props[k];
        else e[k] = props[k];
      }
    }
    return e;
  }

  /** Escape HTML */
  function escHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ========================================================================
  // SECTION 3: PRISM.JS EDITOR PANEL
  // ========================================================================
  // Loads Prism.js + prism-java, sets up textarea overlay on highlighted
  // pre/code element, synchronized scrolling, line numbers, Tab/Enter/
  // bracket handling.
  // ========================================================================

  let prismLoaded = false;

  function loadPrism(callback) {
    // Load Font Awesome for simulator UI icons.
    if (!document.getElementById("sim-fontawesome-css")) {
      const fa = document.createElement("link");
      fa.id = "sim-fontawesome-css";
      fa.rel = "stylesheet";
      fa.href =
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
      document.head.appendChild(fa);
    }

    // Load Prism CSS (Tomorrow theme)
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
    document.head.appendChild(link);

    // Load Prism core
    const script1 = document.createElement("script");
    let finished = false;
    const finish = function () {
      if (finished) return;
      finished = true;
      if (callback) callback();
    };
    script1.src =
      "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js";
    script1.onload = function () {
      // Load Java language
      const script2 = document.createElement("script");
      script2.src =
        "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js";
      script2.onload = function () {
        prismLoaded = true;
        finish();
      };
      script2.onerror = finish;
      document.head.appendChild(script2);
    };
    script1.onerror = finish;
    document.head.appendChild(script1);
  }

  function updateHighlighting() {
    const editor = document.getElementById("sim-code-editor");
    const content = document.getElementById("sim-highlighting-content");
    if (!editor || !content) return;

    let text = editor.value;
    // Prism needs a trailing newline to avoid layout issues
    if (text && text[text.length - 1] === "\n") text += " ";

    if (prismLoaded && window.Prism) {
      content.innerHTML = Prism.highlight(
        text || "",
        Prism.languages.java,
        "java"
      );
    } else {
      content.textContent = text || "";
    }
    updateLineNumbers();
  }

  function updateLineNumbers() {
    const editor = document.getElementById("sim-code-editor");
    const gutter = document.getElementById("sim-line-numbers");
    if (!editor || !gutter) return;

    const lines = (editor.value || "").split("\n").length;
    let html = "";
    for (let i = 1; i <= lines; i++) {
      html += '<span class="sim-line-number">' + i + "</span>";
    }
    gutter.innerHTML = '<div class="sim-line-numbers-inner">' + html + "</div>";
  }

  function syncScroll() {
    const editor = document.getElementById("sim-code-editor");
    const highlighting = document.getElementById("sim-highlighting");
    const content = document.getElementById("sim-highlighting-content");
    const lineNumbers = document.getElementById("sim-line-numbers");
    if (!editor || !highlighting) return;

    highlighting.scrollTop = 0;
    highlighting.scrollLeft = 0;
    if (content) {
      content.style.transform =
        "translate(" + -editor.scrollLeft + "px, " + -editor.scrollTop + "px)";
    }
    if (lineNumbers) {
      const inner = lineNumbers.querySelector(".sim-line-numbers-inner");
      if (inner) inner.style.transform = "translateY(" + -editor.scrollTop + "px)";
    }
  }

  function currentLineIndent(line) {
    const match = (line || "").match(/^\s*/);
    return match ? match[0] : "";
  }

  function insertIntoEditor(editor, text, cursorOffset) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value =
      editor.value.substring(0, start) + text + editor.value.substring(end);
    const cursor = start + (cursorOffset == null ? text.length : cursorOffset);
    editor.selectionStart = editor.selectionEnd = cursor;
    updateHighlighting();
    syncScroll();
  }

  function handleJavaEditorAutocomplete(e) {
    if (window.TelemarkEditor) {
      e.stopPropagation();
      const handled = window.TelemarkEditor.handleKeydown(e);
      if (handled) {
        window.TelemarkEditor.clearDiagnostics(document);
        window.TelemarkEditor.saveDraft(e.currentTarget);
        updateHighlighting();
        syncScroll();
      }
      return handled;
    }

    const editor = e.currentTarget;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    e.stopPropagation();

    if (e.key === "Tab") {
      e.preventDefault();
      insertIntoEditor(editor, "    ");
      return true;
    }

    const selected = editor.value.substring(start, end);
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    const lineBefore = before.split("\n").pop();
    const lineAfter = after.split("\n")[0];
    const indent = currentLineIndent(lineBefore);

    if (e.key === "{") {
      e.preventDefault();
      if (
        /(?:^|\s)(?:if\s*\([^)]*\)|else\s+if\s*\([^)]*\)|else)\s*$/.test(
          lineBefore
        ) &&
        lineAfter.trim() === ""
      ) {
        const inner = indent + "    ";
        insertIntoEditor(editor, " {\n" + inner + "\n" + indent + "}", 3 + inner.length);
      } else {
        insertIntoEditor(editor, "{" + selected + "}", 1 + selected.length);
      }
      return true;
    }

    if ([")", "]", "}", '"', "'"].includes(e.key) && start === end && after[0] === e.key) {
      e.preventDefault();
      editor.selectionStart = editor.selectionEnd = start + 1;
      return true;
    }

    const pairs = { "(": ")", "[": "]", '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      insertIntoEditor(
        editor,
        e.key + selected + pairs[e.key],
        1 + selected.length
      );
      return true;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (lineBefore.trimEnd().endsWith("{") && lineAfter.trimStart().startsWith("}")) {
        const inner = indent + "    ";
        insertIntoEditor(editor, "\n" + inner + "\n" + indent, 1 + inner.length);
      } else {
        const extra = lineBefore.trimEnd().endsWith("{") ? "    " : "";
        insertIntoEditor(editor, "\n" + indent + extra);
      }
      return true;
    }

    return false;
  }

  function wireEditorEvents() {
    const editor = document.getElementById("sim-code-editor");
    if (!editor) return;

    if (window.TelemarkEditor) {
      // The starter is assigned asynchronously by each lesson. Bind saving
      // now, then restore only after the first setCode() call below so a saved
      // student draft cannot be overwritten by the starter.
      window.TelemarkEditor.attach(editor, {
        restore: false,
        onChange: function () {
          clearStaleDiagnostics();
          updateHighlighting();
          syncScroll();
          editor.dispatchEvent(new Event("telemark:code-change"));
        },
      });
    }

    editor.addEventListener("input", function () {
      clearStaleDiagnostics();
      updateHighlighting();
      syncScroll();
    });
    editor.addEventListener("telemark:editor-view-change", function () {
      clearStaleDiagnostics();
      updateHighlighting();
      syncScroll();
    });

    editor.addEventListener("scroll", syncScroll);

    if (!window.TelemarkEditor) {
      editor.addEventListener("keydown", handleJavaEditorAutocomplete);
    }
  }

  // Public API
  window.getCode = function () {
    const editor = document.getElementById("sim-code-editor");
    return editor ? (editor.__telemarkProject ? editor.__telemarkProject.source() : editor.value) : "";
  };

  window.setCode = function (str) {
    const editor = document.getElementById("sim-code-editor");
    if (editor) {
      const source = String(str == null ? "" : str);
      if (editor.__telemarkProject) {
        editor.__telemarkProject.reset(source);
        return;
      }
      editor.value = source;
      if (!editor.__telemarkInitialCodeSet) {
        // Capture this before restoring a saved draft. Reset must always be
        // able to recover the lesson-authored source, even when the draft is
        // empty or the browser's undo history no longer reaches it.
        editor.__telemarkStarterCode = source;
        editor.__telemarkInitialCodeSet = true;
        if (window.TelemarkEditor) window.TelemarkEditor.restoreDraft(editor);
      }
      updateHighlighting();
      syncScroll();
    }
  };

  window.resetCodeToStarter = function () {
    const editor = document.getElementById("sim-code-editor");
    if (!editor || typeof editor.__telemarkStarterCode !== "string") return false;

    if (editor.__telemarkProject) editor.__telemarkProject.reset(editor.__telemarkStarterCode);
    else editor.value = editor.__telemarkStarterCode;
    editor.selectionStart = editor.selectionEnd = 0;
    if (window.TelemarkEditor) {
      window.TelemarkEditor.clearDiagnostics(document);
      // Replace the persisted draft too, so refreshing cannot bring back the
      // accidentally deleted source that the student just reset.
      window.TelemarkEditor.saveDraft(editor);
    }
    updateHighlighting();
    syncScroll();
    return true;
  };

  // ========================================================================
  // SECTION 4: TELEMETRY PANEL
  // ========================================================================
  // Provides addTelemetry(key, value), updateTelemetry(), clearTelemetry().
  // Mimics the FTC Driver Station telemetry display.
  // ========================================================================

  /** Pending telemetry lines before updateTelemetry() is called */
  let telemetryData = {};
  /** Ordered list of keys for display ordering */
  let telemetryOrder = [];
  /** Whether telemetry has ever been flushed this run */
  let telemetryDirty = false;
  /** Coding challenges can reserve this panel exclusively for student telemetry. */
  let telemetryStudentOnly = false;

  function formatTelemetryValue(format, values) {
    let valueIndex = 0;
    return String(format).replace(/%(\.\d+)?([dfs])/g, function (match, precision, type) {
      const value = values[valueIndex++];
      if (type === "s") return String(value);
      if (type === "d") return String(Math.round(Number(value) || 0));
      const decimals = precision ? Number(precision.slice(1)) : 6;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric.toFixed(decimals) : String(value);
    });
  }

  window.addTelemetry = function (key, value) {
    const k = String(key);
    if (!(k in telemetryData)) {
      telemetryOrder.push(k);
    }
    // Format numbers
    let v = value;
    if (arguments.length > 2 && typeof value === "string") {
      v = formatTelemetryValue(value, Array.prototype.slice.call(arguments, 2));
    }
    if (typeof v === "number" && v !== Math.floor(v)) {
      v = v.toFixed(2);
    }
    telemetryData[k] = String(v);
    telemetryDirty = true;
  };

  window.updateTelemetry = function () {
    const panel = document.getElementById("sim-telemetry-log");
    if (!panel) return;

    let html = "";
    for (let i = 0; i < telemetryOrder.length; i++) {
      const k = telemetryOrder[i];
      const v = telemetryData[k];
      html += `<div class="sim-telemetry-line"><span class="sim-telemetry-key">${escHTML(k)}</span>: ${escHTML(v)}</div>`;
    }
    panel.innerHTML = html || (telemetryStudentOnly
      ? ""
      : `<span style="color:#666">No telemetry data</span>`);
    // Auto-scroll to bottom
    panel.scrollTop = panel.scrollHeight;
    telemetryDirty = false;
  };

  window.clearTelemetry = function () {
    telemetryData = {};
    telemetryOrder = [];
    telemetryDirty = false;
    const panel = document.getElementById("sim-telemetry-log");
    if (panel) panel.innerHTML = "";
  };

  window.setTelemetryStudentOnly = function (enabled) {
    telemetryStudentOnly = Boolean(enabled);
    if (telemetryStudentOnly) window.clearTelemetry();
  };

  /**
   * Show an error in telemetry panel (appended, in red)
   */
  function showTelemetryError(msg) {
    if (telemetryStudentOnly) {
      if (typeof window.addHint === "function") {
        window.addHint(
          `<i class="fa-solid fa-triangle-exclamation"></i> ${escHTML(msg)}`,
          "error"
        );
      }
      return;
    }
    const panel = document.getElementById("sim-telemetry-log");
    if (!panel) return;
    const div = document.createElement("div");
    div.className = "sim-telemetry-line sim-telemetry-error";
    div.textContent = "ERROR: " + msg;
    panel.appendChild(div);
    panel.scrollTop = panel.scrollHeight;
  }

  function clearStaleDiagnostics() {
    if (window.TelemarkEditor && typeof window.TelemarkEditor.clearDiagnostics === "function") {
      window.TelemarkEditor.clearDiagnostics(document);
      return;
    }
    if (typeof document.querySelectorAll === "function") {
      document.querySelectorAll(".sim-telemetry-error,.sim-hint.error").forEach(function (element) {
        element.remove();
      });
    }
  }

  window.clearSimulatorDiagnostics = clearStaleDiagnostics;

  // ========================================================================
  // SECTION 5: FLOATING GAMEPAD CARD
  // ========================================================================
  // Builds a complete gamepad UI with joysticks, triggers, face buttons,
  // bumpers, dpad, start/back. All values accessible via global gamepad
  // object. Draggable, resizable, collapsible.
  // ========================================================================

  /** Global gamepad state */
  window.gamepad = {
    left_stick_x: 0,
    left_stick_y: 0,
    right_stick_x: 0,
    right_stick_y: 0,
    left_trigger: 0,
    right_trigger: 0,
    a: false,
    b: false,
    x: false,
    y: false,
    left_bumper: false,
    right_bumper: false,
    dpad_up: false,
    dpad_down: false,
    dpad_left: false,
    dpad_right: false,
    start: false,
    back: false,
  };

  /** All gamepad input element references for setActiveInputs */
  const gamepadInputElements = {};

  function buildGamepadCard() {
    const card = el("div", {
      className: "sim-gamepad-card",
      id: "sim-gamepad-card",
    });

    // Title bar
    const titlebar = el("div", {
      className: "sim-gamepad-titlebar",
      id: "sim-gamepad-titlebar",
    });
    titlebar.innerHTML = `<span class="sim-gamepad-title-label"><i class="fa-solid fa-gamepad sim-gp-icon"></i> Gamepad 1</span>`;
    const collapseBtn = el("button", {
      className: "sim-gp-collapse-btn",
      id: "sim-gp-collapse-btn",
    });
    collapseBtn.innerHTML = "−";
    titlebar.appendChild(collapseBtn);
    card.appendChild(titlebar);

    // Body
    const body = el("div", {
      className: "sim-gamepad-body",
      id: "sim-gamepad-body",
    });

    body.appendChild(createImageOverlayGamepad());
    card.appendChild(body);

    // Resize handle
    const resizeHandle = el("div", {
      className: "sim-gamepad-resize-handle",
      id: "sim-gamepad-resize-handle",
    });
    card.appendChild(resizeHandle);

    document.body.appendChild(card);

    // Wire drag, resize, collapse
    wireGamepadCardEvents(card, titlebar, collapseBtn, body, resizeHandle);
  }

  function createImageOverlayGamepad() {
    const wrap = el("div", {
      className: "sim-controller-wrap",
      id: "sim-controller-wrap",
    });

    const img = el("img", {
      className: "sim-controller-img",
    });
    img.alt = "Logitech gamepad";
    img.src =
      "https://resource.logitechg.com/w_776,h_437,ar_16:9,c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/f310/f310-feature-3.png";
    wrap.appendChild(img);

    wrap.appendChild(createImageTrigger("left_trigger", "left"));
    wrap.appendChild(createImageTrigger("right_trigger", "right"));
    wrap.appendChild(createImageJoystick("left", "left_stick_x", "left_stick_y"));
    wrap.appendChild(createImageJoystick("right", "right_stick_x", "right_stick_y"));

    wrap.appendChild(createImageButton("left_bumper", "sim-bumper-left"));
    wrap.appendChild(createImageButton("right_bumper", "sim-bumper-right"));
    wrap.appendChild(createImageButton("back", "sim-small-back"));
    wrap.appendChild(createImageButton("start", "sim-small-start"));
    wrap.appendChild(createImageButton("a", "sim-face-a"));
    wrap.appendChild(createImageButton("b", "sim-face-b"));
    wrap.appendChild(createImageButton("x", "sim-face-x"));
    wrap.appendChild(createImageButton("y", "sim-face-y"));

    const dpad = el("div", { className: "sim-gp-overlay sim-dpad-overlay" });
    dpad.appendChild(createImageButton("dpad_up", "sim-dpad-image-btn sim-dpad-image-up"));
    dpad.appendChild(createImageButton("dpad_down", "sim-dpad-image-btn sim-dpad-image-down"));
    dpad.appendChild(createImageButton("dpad_left", "sim-dpad-image-btn sim-dpad-image-left"));
    dpad.appendChild(createImageButton("dpad_right", "sim-dpad-image-btn sim-dpad-image-right"));
    wrap.appendChild(dpad);

    return wrap;
  }

  function createImageButton(prop, className) {
    const btn = el("div", { className: "sim-gp-overlay button " + className });
    btn.setAttribute("data-gp-input", prop);
    gamepadInputElements[prop] = btn;
    wireHoldButton(btn, prop);
    return btn;
  }

  function wireHoldButton(btn, prop) {
    function press(e) {
      e.preventDefault();
      window.gamepad[prop] = true;
      btn.classList.add("pressed");
      if (btn.setPointerCapture && e.pointerId != null) {
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
    function release() {
      window.gamepad[prop] = false;
      btn.classList.remove("pressed");
    }
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    btn.addEventListener("mouseleave", release);
  }

  function createImageTrigger(prop, side) {
    const trigger = el("div", {
      className: "sim-trigger-image " + side,
    });
    trigger.setAttribute("data-gp-input", prop);
    gamepadInputElements[prop] = trigger;

    const fill = el("div", { className: "sim-trigger-fill" });
    trigger.appendChild(fill);

    let dragging = false;
    function update(e) {
      const rect = trigger.getBoundingClientRect();
      const pct = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      window.gamepad[prop] = pct;
      fill.style.height = pct * 100 + "%";
    }
    function reset() {
      dragging = false;
      window.gamepad[prop] = 0;
      fill.style.height = "0%";
    }
    trigger.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      dragging = true;
      trigger.setPointerCapture(e.pointerId);
      update(e);
    });
    trigger.addEventListener("pointermove", function (e) {
      if (dragging) update(e);
    });
    trigger.addEventListener("pointerup", reset);
    trigger.addEventListener("pointercancel", reset);
    trigger.addEventListener("lostpointercapture", reset);
    return trigger;
  }

  function createImageJoystick(side, xProp, yProp) {
    const zone = el("div", {
      className: "sim-gp-overlay sim-stick-zone sim-stick-" + side,
    });
    zone.setAttribute("data-gp-input", xProp + "," + yProp);
    gamepadInputElements[xProp] = zone;
    gamepadInputElements[yProp] = zone;

    const knob = el("div", { className: "sim-stick-knob" });
    zone.appendChild(knob);

    wireJoystick(zone, knob, null, xProp, yProp);
    return zone;
  }

  /** Create a joystick input section */
  function createJoystick(side, xProp, yProp) {
    const section = el("div", { className: "sim-gp-section" });
    section.setAttribute("data-gp-input", xProp + "," + yProp);
    gamepadInputElements[xProp] = section;
    gamepadInputElements[yProp] = section;

    const label = el("div", { className: "sim-gp-section-label" });
    label.textContent = side === "left" ? "Left Stick" : "Right Stick";
    section.appendChild(label);

    const zone = el("div", { className: "sim-joystick-zone" });
    zone.id = "sim-joy-zone-" + side;

    // Crosshairs
    zone.appendChild(el("div", { className: "sim-joystick-crosshair-h" }));
    zone.appendChild(el("div", { className: "sim-joystick-crosshair-v" }));

    // Knob
    const knob = el("div", { className: "sim-joystick-knob" });
    knob.id = "sim-joy-knob-" + side;
    zone.appendChild(knob);

    section.appendChild(zone);

    // Value label
    const valueLabel = el("div", { className: "sim-joystick-value" });
    valueLabel.id = "sim-joy-value-" + side;
    valueLabel.textContent = "0.00, 0.00";
    section.appendChild(valueLabel);

    // Wire joystick interaction
    wireJoystick(zone, knob, valueLabel, xProp, yProp);

    return section;
  }

  function wireJoystick(zone, knob, valueLabel, xProp, yProp) {
    let dragging = false;
    let pointerId = null;

    zone.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      dragging = true;
      pointerId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      zone.classList.add("active");
      knob.classList.add("active");
      updateJoystickFromPointer(e);
    });

    zone.addEventListener("pointermove", function (e) {
      if (dragging && e.pointerId === pointerId) {
        updateJoystickFromPointer(e);
      }
    });

    function release() {
      dragging = false;
      pointerId = null;
      zone.classList.remove("active");
      knob.classList.remove("active");
      window.gamepad[xProp] = 0;
      window.gamepad[yProp] = 0;
      knob.style.left = "50%";
      knob.style.top = "50%";
      if (valueLabel) valueLabel.textContent = "0.00, 0.00";
    }

    zone.addEventListener("pointerup", release);
    zone.addEventListener("pointercancel", release);
    zone.addEventListener("lostpointercapture", release);
    window.addEventListener("blur", release);

    function updateJoystickFromPointer(e) {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = Math.min(rect.width, rect.height) / 2 - 14; // knob radius

      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }

      const nx = Math.max(-1, Math.min(1, dx / maxR));
      // FTC gamepad axes report up as a negative Y value.
      const ny = Math.max(-1, Math.min(1, dy / maxR));

      window.gamepad[xProp] = nx;
      window.gamepad[yProp] = ny;

      knob.style.left = 50 + (dx / (rect.width / 2)) * 50 + "%";
      knob.style.top = 50 + (dy / (rect.height / 2)) * 50 + "%";

      if (valueLabel) valueLabel.textContent = nx.toFixed(2) + ", " + ny.toFixed(2);
    }
  }

  /** Create a trigger slider */
  function createTrigger(prop, label) {
    const container = el("div", { className: "sim-trigger-container" });
    container.setAttribute("data-gp-input", prop);
    gamepadInputElements[prop] = container;

    const lbl = el("div", { className: "sim-gp-section-label" });
    lbl.textContent = label;
    container.appendChild(lbl);

    const slider = el("div", { className: "sim-trigger-slider" });
    slider.id = "sim-trigger-" + prop;
    const fill = el("div", { className: "sim-trigger-fill" });
    fill.id = "sim-trigger-fill-" + prop;
    fill.style.height = "0%";
    slider.appendChild(fill);
    container.appendChild(slider);

    const valueLabel = el("div", { className: "sim-trigger-value" });
    valueLabel.id = "sim-trigger-val-" + prop;
    valueLabel.textContent = "0.00";
    container.appendChild(valueLabel);

    // Wire interaction
    let dragging = false;

    function updateTrigger(e) {
      const rect = slider.getBoundingClientRect();
      const pct = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      window.gamepad[prop] = pct;
      fill.style.height = pct * 100 + "%";
      valueLabel.textContent = pct.toFixed(2);
    }

    slider.addEventListener("pointerdown", function (e) {
      dragging = true;
      slider.setPointerCapture(e.pointerId);
      updateTrigger(e);
    });
    slider.addEventListener("pointermove", function (e) {
      if (dragging) updateTrigger(e);
    });
    slider.addEventListener("pointerup", function () {
      dragging = false;
      window.gamepad[prop] = 0;
      fill.style.height = "0%";
      valueLabel.textContent = "0.00";
    });
    slider.addEventListener("pointercancel", function () {
      dragging = false;
      window.gamepad[prop] = 0;
      fill.style.height = "0%";
      valueLabel.textContent = "0.00";
    });

    return container;
  }

  /** Create face buttons (A, B, X, Y) in a cross pattern */
  function createFaceButtons() {
    const section = el("div", { className: "sim-gp-section" });
    const lbl = el("div", { className: "sim-gp-section-label" });
    lbl.textContent = "Buttons";
    section.appendChild(lbl);

    const grid = el("div", { className: "sim-gp-btn-grid face-buttons" });

    // 3x3 grid: [empty, Y, empty], [X, empty, B], [empty, A, empty]
    const layout = [
      [null, "y", null],
      ["x", null, "b"],
      [null, "a", null],
    ];
    const colors = {
      a: "btn-a",
      b: "btn-b",
      x: "btn-x",
      y: "btn-y",
    };

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const name = layout[r][c];
        if (name) {
          const btn = createToggleButton(
            name,
            name.toUpperCase(),
            "sim-gp-btn " + colors[name]
          );
          grid.appendChild(btn);
        } else {
          const spacer = el("div");
          spacer.style.width = "32px";
          spacer.style.height = "32px";
          grid.appendChild(spacer);
        }
      }
    }

    section.appendChild(grid);
    return section;
  }

  /** Create DPad */
  function createDPad() {
    const section = el("div", { className: "sim-gp-section" });
    const lbl = el("div", { className: "sim-gp-section-label" });
    lbl.textContent = "D-Pad";
    section.appendChild(lbl);

    const grid = el("div", { className: "sim-dpad-grid" });
    const layout = [
      [null, "dpad_up", null],
      ["dpad_left", null, "dpad_right"],
      [null, "dpad_down", null],
    ];
    const arrows = {
      dpad_up: "▲",
      dpad_down: "▼",
      dpad_left: "<",
      dpad_right: ">",
    };

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const name = layout[r][c];
        if (name) {
          const btn = createToggleButton(
            name,
            arrows[name],
            "sim-dpad-btn"
          );
          grid.appendChild(btn);
        } else if (r === 1 && c === 1) {
          const center = el("div", { className: "sim-dpad-btn sim-dpad-center" });
          grid.appendChild(center);
        } else {
          const spacer = el("div");
          spacer.style.width = "28px";
          spacer.style.height = "28px";
          grid.appendChild(spacer);
        }
      }
    }

    section.appendChild(grid);
    return section;
  }

  /** Create a bumper button */
  function createBumper(prop, label) {
    const btn = createToggleButton(prop, label, "sim-gp-bumper");
    return btn;
  }

  /** Create a small button (start/back) */
  function createSmallButton(prop, label) {
    return createToggleButton(prop, label, "sim-gp-small-btn");
  }

  /**
   * Generic toggle button factory.
   * Clicking toggles pressed state and updates gamepad[prop].
   */
  function createToggleButton(prop, label, className) {
    const btn = el("div", { className: className });
    btn.textContent = label;
    btn.setAttribute("data-gp-input", prop);
    btn.style.cursor = "pointer";
    gamepadInputElements[prop] = btn;

    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      const isPressed = !window.gamepad[prop];
      window.gamepad[prop] = isPressed;
      if (isPressed) {
        btn.classList.add("pressed");
      } else {
        btn.classList.remove("pressed");
      }
    });

    return btn;
  }

  /** Wire gamepad card drag, resize, collapse */
  function wireGamepadCardEvents(card, titlebar, collapseBtn, body, resizeHandle) {
    wireFloatingGamepadCard(card, titlebar, collapseBtn, body, resizeHandle);
  }

  /**
   * setActiveInputs(array) — highlights lesson-relevant controls.
   * Example: setActiveInputs(["y", "a", "left_stick_y"])
   * Input names that share an element (e.g. left_stick_x and left_stick_y
   * share a joystick) are handled: if ANY shared input is listed, the element
   * is highlighted. Unlisted inputs remain usable for experimentation.
   */
  window.setActiveInputs = function (activeList) {
    const activeSet = new Set(activeList);

    // Track which elements should be highlighted
    const elementActive = new Map();

    for (const prop in gamepadInputElements) {
      const elem = gamepadInputElements[prop];
      if (!elementActive.has(elem)) {
        elementActive.set(elem, false);
      }
      if (activeSet.has(prop)) {
        elementActive.set(elem, true);
      }
    }

    elementActive.forEach(function (isActive, elem) {
      if (isActive) {
        elem.classList.remove("sim-gp-input-inactive");
        elem.classList.add("sim-gp-input-recommended");
      } else {
        elem.classList.remove("sim-gp-input-recommended");
        elem.classList.remove("sim-gp-input-inactive");
      }
    });
  };

  // ========================================================================
  // SECTION 6: PANEL RESIZER
  // ========================================================================

  function wireResizerEvents() {
    const resizer = document.getElementById("sim-resizer");
    const leftPanel = document.getElementById("sim-left-panel");
    const rightPanel = document.getElementById("sim-right-panel");
    if (!resizer || !leftPanel || !rightPanel) return;

    let isResizing = false;
    let activePointerId = null;

    function pxValue(value, fallback) {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function resizeScene() {
      window.dispatchEvent(new Event("resize"));
    }

    function setPanelWidth(clientX) {
      const bodyRect = document.body.getBoundingClientRect();
      const totalWidth = bodyRect.width;
      const resizerWidth = resizer.offsetWidth || 6;
      const leftStyle = window.getComputedStyle(leftPanel);
      const rightStyle = window.getComputedStyle(rightPanel);
      const minLeft = pxValue(leftStyle.minWidth, 260);
      const minRight = pxValue(rightStyle.minWidth, 260);
      const minWidth = Math.min(minLeft, Math.max(160, totalWidth - resizerWidth - minRight));
      const maxWidth = Math.max(minWidth, totalWidth - resizerWidth - minRight);
      const width = Math.max(minWidth, Math.min(maxWidth, clientX - bodyRect.left));

      leftPanel.style.flex = "0 0 " + width + "px";
      leftPanel.style.width = width + "px";
      rightPanel.style.flex = "1 1 0";
      rightPanel.style.width = "auto";
      resizeScene();
    }

    resizer.addEventListener("pointerdown", function (e) {
      isResizing = true;
      activePointerId = e.pointerId;
      resizer.classList.add("active");
      if (resizer.setPointerCapture && e.pointerId != null) {
        resizer.setPointerCapture(e.pointerId);
      }
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      setPanelWidth(e.clientX);
      e.preventDefault();
    });

    function moveResize(e) {
      if (!isResizing) return;
      if (activePointerId != null && e.pointerId != null && e.pointerId !== activePointerId) return;
      setPanelWidth(e.clientX);
      e.preventDefault();
    }

    document.addEventListener("pointermove", moveResize);
    window.addEventListener("pointermove", moveResize);

    function endResize() {
      isResizing = false;
      activePointerId = null;
      resizer.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      resizeScene();
    }

    document.addEventListener("pointerup", endResize);
    document.addEventListener("pointercancel", endResize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  }

  // ========================================================================
  // SECTION 7: RUN/STOP CONTROLS & RUNTIME
  // ========================================================================

  let initialized = false;
  let running = false;
  let loopInterval = null;
  let initLoopInterval = null;
  let pendingLoopFn = null;
  let timerInterval = null;
  let runtimeStart = 0;
  let previousPhysicsTime = 0;
  let stopRequested = true;
  let studentLifecycle = null;
  let lifecycleError = false;
  const pendingSleepTimers = new Map();

  window.getRuntime = function () {
    return runtimeStart ? (Date.now() - runtimeStart) / 1000 : 0;
  };

  window.isStopRequested = function () {
    return stopRequested;
  };

  /**
   * sleep(ms) for use in LinearOpMode transpiled code.
   * Returns a Promise that resolves after ms milliseconds.
   */
  window.sleep = function (ms) {
    return new Promise(function (resolve) {
      const timer = setTimeout(function () {
        pendingSleepTimers.delete(timer);
        resolve();
      }, ms);
      pendingSleepTimers.set(timer, resolve);
    });
  };

  function wireRunStopEvents() {
    const btnRun = document.getElementById("sim-btn-run");
    const btnStop = document.getElementById("sim-btn-stop");

    if (btnRun) {
      btnRun.addEventListener("click", function () {
        if (!initialized) handleInit();
        else handleStart();
      });
    }
    if (btnStop) {
      btnStop.addEventListener("click", function () {
        handleStop();
      });
    }
  }

  function setPrimaryButton(label, disabled) {
    const btnRun = document.getElementById("sim-btn-run");
    if (!btnRun) return;
    btnRun.textContent = label;
    btnRun.disabled = !!disabled;
  }

  function setDriverStationState(label, color) {
    const dsState = document.getElementById("sim-ds-state");
    if (!dsState) return;
    dsState.textContent = label;
    dsState.style.color = color;
  }

  function startTimer() {
    runtimeStart = Date.now();
    previousPhysicsTime = runtimeStart;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function () {
      const now = Date.now();
      const dt = Math.max(0, (now - previousPhysicsTime) / 1000);
      previousPhysicsTime = now;
      if (window.hardwareMap && typeof window.hardwareMap.tick === "function") {
        window.hardwareMap.tick(dt, true);
      }
      managedJavaRuntimes.forEach(function (runtime) {
        if (typeof runtime.tick === "function") runtime.tick(dt);
      });
      const timerVal = document.getElementById("sim-timer-val");
      if (timerVal) {
        timerVal.textContent = (
          (now - runtimeStart) /
          1000
        ).toFixed(2);
      }
    }, 50);
  }

  function startPendingLoop() {
    if (!pendingLoopFn) return;
    const fn = pendingLoopFn;
    pendingLoopFn = null;
    window._simStartLoop(fn);
  }

  function reportLifecycleError(context, error) {
    lifecycleError = true;
    const message = error && error.message ? error.message : String(error || "Unknown error");
    showTelemetryError(context + ": " + message);
    console.error("Telemark simulator " + context, error);
  }

  function validateFullStudentSource() {
    if (!window.TelemarkJava || typeof window.TelemarkJava.compile !== "function") {
      reportLifecycleError(
        "Java compile error",
        new Error("Telemark Java compiler is unavailable")
      );
      return false;
    }

    if (typeof window.getCode !== "function") {
      reportLifecycleError(
        "Java compile error",
        new Error("The simulator code editor is unavailable")
      );
      return false;
    }

    try {
      let source = window.getCode();
      if (typeof source !== "string") {
        throw new Error("The simulator did not provide Java source text");
      }
      if (typeof window.prepareSimulatorValidationSource === "function") {
        source = window.prepareSimulatorValidationSource(source);
      }
      const validation = compileStudentSource(source);
      if (validation.ok) return true;

      const diagnostic = validation.diagnostics && validation.diagnostics[0];
      const message = diagnostic
        ? `${diagnostic.message} (line ${diagnostic.line}, column ${diagnostic.column})`
        : "The Java source could not be compiled.";
      reportLifecycleError("Java compile error", new Error(message));
    } catch (error) {
      reportLifecycleError("Java compile error", error);
    }

    return false;
  }

  function resetAfterLifecycleError() {
    initialized = false;
    running = false;
    stopRequested = true;
    pendingLoopFn = null;
    if (loopInterval) clearInterval(loopInterval);
    if (initLoopInterval) clearInterval(initLoopInterval);
    if (timerInterval) clearInterval(timerInterval);
    loopInterval = null;
    initLoopInterval = null;
    timerInterval = null;
    pendingSleepTimers.forEach(function (resolve, timer) {
      clearTimeout(timer);
      resolve();
    });
    pendingSleepTimers.clear();
    studentLifecycle = null;
    runtimeStart = 0;
    previousPhysicsTime = 0;
    if (window.TelemarkJava && typeof window.TelemarkJava.createBatteryModel === "function"
        && window.hardwareMap && typeof window.hardwareMap.stopBattery === "function") {
      window.hardwareMap.stopBattery();
    }
    managedJavaRuntimes.forEach(function (runtime) {
      if (typeof runtime.stop === "function") runtime.stop();
    });

    // Challenge pages often keep their own running flags, animation tokens,
    // and hardware state. Give them the same cleanup notification as a normal
    // Stop so a corrected program can be initialized immediately after an
    // error. Do not call the student's stop() method here: the lifecycle that
    // just failed is no longer safe to execute.
    if (typeof window.onStop === "function") {
      try {
        window.onStop();
      } catch (cleanupError) {
        const cleanupMessage = cleanupError && cleanupError.message
          ? cleanupError.message
          : String(cleanupError || "Unknown error");
        showTelemetryError("simulator cleanup error: " + cleanupMessage);
        console.error("Telemark simulator error cleanup", cleanupError);
      }
    }

    setDriverStationState("STOPPED", "var(--danger)");
    setPrimaryButton("Init", false);
    const timerVal = document.getElementById("sim-timer-val");
    if (timerVal) timerVal.textContent = "0.00";
  }

  function handleInit() {
    if (initialized || running) return;
    clearStaleDiagnostics();
    initialized = true;
    running = false;
    stopRequested = false;
    pendingLoopFn = null;
    studentLifecycle = null;
    lifecycleError = false;

    if (window.TelemarkJava && typeof window.TelemarkJava.createBatteryModel === "function") {
      window.hardwareMap.resetBattery();
    }
    managedJavaRuntimes.forEach(function (runtime) {
      if (typeof runtime.resetBattery === "function") runtime.resetBattery();
    });

    const telLog = document.getElementById("sim-telemetry-log");

    if (telLog) telLog.innerHTML = "";
    setDriverStationState("INIT", "var(--active)");
    setPrimaryButton("Start", false);

    // Clear pending telemetry
    window.clearTelemetry();

    // Validate the complete editor source before a challenge-specific callback
    // can selectively extract or execute methods. This prevents malformed code
    // in an unused lifecycle method from being silently ignored by pages with
    // custom runners.
    if (!validateFullStudentSource()) {
      resetAfterLifecycleError();
      return false;
    }

    // Call the challenge's explicit init callback. Existing challenge files
    // that still define onRun are treated as init for backward compatibility.
    try {
      if (typeof window.onInit === "function") {
        window.onInit();
      } else if (typeof window.onRun === "function") {
        window.onRun();
      }
    } catch (error) {
      reportLifecycleError("init() runtime error", error);
    }

    if (lifecycleError) {
      resetAfterLifecycleError();
      return false;
    }

    if (studentLifecycle && typeof studentLifecycle.initLoop === "function") {
      initLoopInterval = setInterval(function () {
        if (!initialized || running) return;
        try {
          studentLifecycle.initLoop();
        } catch (error) {
          reportLifecycleError("init_loop() runtime error", error);
          resetAfterLifecycleError();
        }
      }, 50);
    }
    return true;
  }

  function handleStart() {
    if (!initialized || running) return;
    running = true;
    stopRequested = false;

    if (initLoopInterval) {
      clearInterval(initLoopInterval);
      initLoopInterval = null;
    }

    setDriverStationState("RUNNING", "var(--good)");
    setPrimaryButton("Start", true);
    if (window.hardwareMap && typeof window.hardwareMap.startBattery === "function") {
      window.hardwareMap.startBattery();
    }
    managedJavaRuntimes.forEach(function (runtime) {
      if (typeof runtime.start === "function") runtime.start();
    });
    startTimer();

    try {
      if (studentLifecycle && typeof studentLifecycle.start === "function") {
        studentLifecycle.start();
      }
      startPendingLoop();

      if (typeof window.onStart === "function") {
        window.onStart();
      }
    } catch (error) {
      reportLifecycleError("start() runtime error", error);
      resetAfterLifecycleError();
      return false;
    }
    return true;
  }

  function handleRun() {
    if (!initialized) handleInit();
    if (initialized && !running) handleStart();
  }

  function handleStop() {
    initialized = false;
    running = false;
    stopRequested = true;
    pendingLoopFn = null;

    if (loopInterval) {
      clearInterval(loopInterval);
      loopInterval = null;
    }
    if (initLoopInterval) {
      clearInterval(initLoopInterval);
      initLoopInterval = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    pendingSleepTimers.forEach(function (resolve, timer) {
      clearTimeout(timer);
      resolve();
    });
    pendingSleepTimers.clear();
    previousPhysicsTime = 0;

    const dsState = document.getElementById("sim-ds-state");
    const btnRun = document.getElementById("sim-btn-run");
    const timerVal = document.getElementById("sim-timer-val");

    if (dsState) {
      dsState.textContent = "STOPPED";
      dsState.style.color = "var(--danger)";
    }
    if (btnRun) {
      btnRun.disabled = false;
      btnRun.textContent = "Init";
    }
    if (timerVal) timerVal.textContent = "0.00";

    if (studentLifecycle && typeof studentLifecycle.stop === "function") {
      try {
        studentLifecycle.stop();
      } catch (error) {
        reportLifecycleError("stop() runtime error", error);
      }
    }
    studentLifecycle = null;

    // Call the challenge's onStop callback
    if (typeof window.onStop === "function") {
      try {
        window.onStop();
      } catch (error) {
        reportLifecycleError("simulator stop callback error", error);
      }
    }
    if (window.hardwareMap && typeof window.hardwareMap.stopAll === "function") {
      window.hardwareMap.stopAll();
      if (window.TelemarkJava && typeof window.TelemarkJava.createBatteryModel === "function") {
        window.hardwareMap.tick(0, false);
      }
    }
    managedJavaRuntimes.forEach(function (runtime) {
      if (typeof runtime.stop === "function") runtime.stop();
    });
  }

  // Expose for transpiler
  window._simHandleRun = handleRun;
  window._simHandleInit = handleInit;
  window._simHandleStart = handleStart;
  window._simHandleStop = handleStop;
  window._simIsRunning = function () {
    return running;
  };
  window._simIsInitialized = function () {
    return initialized;
  };

  // ========================================================================
  // SECTION 8: MINI-TRANSPILER ENGINE
  // ========================================================================
  // Converts student Java code into executable JavaScript.
  // ========================================================================

  /**
   * Extract the body of a method from Java source code.
   * Returns the code between the opening { and closing } of the method.
   */
  function getMethodBody(code, name) {
    if (window.TelemarkJava) {
      try {
        const method = window.TelemarkJava.findMethod(code, name);
        return method ? method.body : null;
      } catch (error) {
        showTelemetryError(
          `${error.message} (line ${error.line || 1}, column ${error.column || 1})`
        );
        return null;
      }
    }

    // Match "void methodName(...) {"
    const re = new RegExp(
      "(?:public\\s+)?void\\s+" + name + "\\s*\\([^)]*\\)\\s*\\{"
    );
    const m = re.exec(code);
    if (!m) return null;

    let idx = m.index + m[0].length;
    let depth = 1;
    for (; idx < code.length; idx++) {
      if (code[idx] === "{") depth++;
      else if (code[idx] === "}") {
        depth--;
        if (depth === 0) {
          return code.slice(m.index + m[0].length, idx);
        }
      }
    }
    return null;
  }

  /**
   * Transpile a block of Java code into JavaScript.
   */
  function transpileJava(java) {
    if (window.TelemarkJava) {
      return window.TelemarkJava.transpileBody(java, {
        gamepad1Name: "gamepad",
        gamepad2Name: "gamepad2",
        addTelemetryName: "addTelemetry",
        updateTelemetryName: "updateTelemetry",
        clearTelemetryName: "clearTelemetry",
      });
    }

    let js = java;

    // Strip Java type declarations → let
    js = js.replace(
      /\b(double|int|boolean|String|float|long|byte|short|char)\s+(?=[a-zA-Z_])/g,
      "let "
    );

    // Strip common FTC hardware type declarations → let
    js = js.replace(
      /\b(DcMotor|DcMotorEx|Servo|CRServo|TouchSensor|DigitalChannel|ColorSensor|DistanceSensor|IMU|BNO055IMU)\s+(?=[a-zA-Z_])/g,
      "let "
    );

    // Handle array declarations: let[] → let
    js = js.replace(/\blet\s*\[\s*\]/g, "let ");

    // Replace gamepad1. with gamepad.
    js = js.replace(/\bgamepad1\./g, "gamepad.");

    // Replace telemetry.addData( with addTelemetry(
    js = js.replace(/\btelemetry\s*\.\s*addData\s*\(/g, "addTelemetry(");

    // Replace telemetry.update() with updateTelemetry()
    js = js.replace(
      /\btelemetry\s*\.\s*update\s*\(\s*\)/g,
      "updateTelemetry()"
    );

    // Replace telemetry.clear() with clearTelemetry()
    js = js.replace(
      /\btelemetry\s*\.\s*clear\s*\(\s*\)/g,
      "clearTelemetry()"
    );

    // Replace getRuntime() — already a global function, just ensure it's available
    // (No replacement needed since getRuntime is defined globally)

    // Replace hardwareMap.get(Type.class, "name") with hardwareMap.get("Type", "name")
    js = js.replace(
      /\bhardwareMap\s*\.\s*get\s*\(\s*(\w+)\.class\s*,/g,
      'hardwareMap.get("$1",'
    );

    // Replace common FTC enum constants with simple simulator values
    js = js.replace(
      /\bServo\s*\.\s*Direction\s*\.\s*(FORWARD|REVERSE)\b/g,
      '"$1"'
    );
    js = js.replace(
      /\b(?:DcMotor|DcMotorSimple)\s*\.\s*Direction\s*\.\s*(FORWARD|REVERSE)\b/g,
      '"$1"'
    );

    // Add iteration safety cap to while and for loops
    js = addLoopSafety(js);

    return js;
  }

  /**
   * Add iteration safety caps to while and for loops.
   * Injects a counter that throws after 10000 iterations.
   */
  function addLoopSafety(js) {
    let counter = 0;

    // Process while loops
    js = js.replace(
      /\bwhile\s*\(([^)]*)\)\s*\{/g,
      function (match, cond) {
        const varName = "__loopGuard" + counter++;
        return (
          "let " +
          varName +
          "=0; while(" +
          cond +
          "){ if(++" +
          varName +
          ">10000) throw new Error('Loop exceeded 10000 iterations — possible infinite loop');"
        );
      }
    );

    // Process for loops
    js = js.replace(
      /\bfor\s*\(([^)]*)\)\s*\{/g,
      function (match, cond) {
        const varName = "__loopGuard" + counter++;
        return (
          "let " +
          varName +
          "=0; for(" +
          cond +
          "){ if(++" +
          varName +
          ">10000) throw new Error('Loop exceeded 10000 iterations — possible infinite loop');"
        );
      }
    );

    return js;
  }

  /**
   * Detect blocking loops in loop() body.
   * If while(gamepad... or while(true) is found, throw before executing.
   */
  function detectBlockingLoop(javaBody) {
    // Check for while loops that reference gamepad or are while(true)
    const blockingPatterns = [
      /\bwhile\s*\(\s*gamepad/,
      /\bwhile\s*\(\s*true\s*\)/,
      /\bwhile\s*\(\s*!?\s*gamepad/,
    ];
    for (const pattern of blockingPatterns) {
      if (pattern.test(javaBody)) {
        return true;
      }
    }
    return false;
  }

  function stripMethodBodies(code) {
    const chars = code.split("");
    const re =
      /(?:@\w+(?:\([^)]*\))?\s*)*(?:public|private|protected)?\s*(?:static\s+)?(?:void|[\w<>[\]]+)\s+\w+\s*\([^)]*\)\s*\{/g;
    let match;

    while ((match = re.exec(code)) !== null) {
      let idx = re.lastIndex;
      let depth = 1;
      for (; idx < code.length; idx++) {
        if (code[idx] === "{") depth++;
        else if (code[idx] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }

      for (let i = re.lastIndex; i < idx; i++) {
        chars[i] = " ";
      }
      re.lastIndex = idx + 1;
    }

    return chars.join("");
  }

  function extractClassFields(code) {
    const fields = [];
    const fieldMap = {};
    const classOnlyCode = stripMethodBodies(code);
    const re =
      /\b(DcMotor|DcMotorEx|Servo|CRServo|TouchSensor|DigitalChannel|ColorSensor|DistanceSensor|IMU|BNO055IMU|double|int|boolean|String|float|long|byte|short|char)\s+([^;]+);/g;
    let match;

    while ((match = re.exec(classOnlyCode)) !== null) {
      match[2].split(",").forEach(function (part) {
        const nameMatch = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s*=\s*([\s\S]+))?$/);
        if (nameMatch && !fieldMap[nameMatch[1]]) {
          const field = {
            name: nameMatch[1],
            initializer: nameMatch[2] ? transpileJava(nameMatch[2].trim()) : undefined,
          };
          fieldMap[field.name] = field;
          fields.push(field);
        }
      });
    }

    return fields;
  }

  function wrapWithClassFieldScope(js, fields) {
    if (!fields || fields.length === 0) return js;

    const load = fields
      .map(function (field) {
        let expr = "__scope." + field.name;
        if (field.initializer !== undefined) {
          expr =
            "(__scope." +
            field.name +
            "!==undefined?__scope." +
            field.name +
            ":(" +
            field.initializer +
            "))";
        }
        return "var " + field.name + "=" + expr + ";";
      })
      .join("\n");
    const store = fields
      .map(function (field) {
        return "__scope." + field.name + "=" + field.name + ";";
      })
      .join("\n");

    return load + "\n" + js + "\n" + store;
  }

  /**
   * transpileAndRun(javaCode, initHandler, loopHandler)
   * 
   * - Extracts init() and loop() method bodies from javaCode
   * - Transpiles each to JavaScript
   * - Calls initHandler with a function wrapping the transpiled init body
   * - Calls loopHandler with a function wrapping the transpiled loop body,
   *   which will be invoked at 20Hz via setInterval
   * 
   * initHandler(initFn): called once with the init function
   * loopHandler(loopFn): called with the loop function; the base sets up
   *   the 20Hz interval and stores it for stopExecution()
   */
  window.transpileAndRun = function (javaCode, initHandler, loopHandler) {
    try {
      if (window.TelemarkJava) {
        const compiled = compileStudentSource(javaCode, {
          gamepad1: window.gamepad,
          gamepad2: window.gamepad2,
          hardwareMap: window.hardwareMap,
          addTelemetry: window.addTelemetry,
          updateTelemetry: window.updateTelemetry,
          clearTelemetry: window.clearTelemetry,
          getRuntime: window.getRuntime,
          resetRuntime: function () {
            runtimeStart = Date.now();
          },
          isStopRequested: window.isStopRequested,
          opModeIsActive: function () {
            return initialized && running && !stopRequested;
          },
          waitForStart: function () {
            return new Promise(function (resolve) {
              const poll = setInterval(function () {
                if (running || stopRequested) {
                  clearInterval(poll);
                  resolve();
                }
              }, 20);
            });
          },
          sleep: window.sleep,
        });

        if (!compiled.ok) {
          const diagnostic = compiled.diagnostics[0];
          reportLifecycleError(
            "Java compile error",
            new Error(`${diagnostic.message} (line ${diagnostic.line}, column ${diagnostic.column})`)
          );
          studentLifecycle = null;
          return false;
        }

        clearStaleDiagnostics();

        function telemetryFrame(method) {
          if (typeof method !== "function") return null;
          return function () {
            window.clearTelemetry();
            const result = method();
            window.updateTelemetry();
            return result;
          };
        }

        // Iterative FTC OpModes receive an automatic telemetry frame after
        // every lifecycle callback. Without this, addData() in init_loop(),
        // start(), or stop() remained pending and appeared to do nothing.
        studentLifecycle = {
          initLoop: telemetryFrame(compiled.methods.init_loop),
          start: telemetryFrame(compiled.methods.start),
          stop: telemetryFrame(compiled.methods.stop),
        };

        if (compiled.kind === "linear") {
          Promise.resolve(compiled.methods.runOpMode?.()).catch(function (error) {
            reportLifecycleError("runOpMode() runtime error", error);
            window.stopExecution();
          });
          return true;
        }

        if (compiled.methods.init && initHandler) {
          initHandler(compiled.methods.init);
        } else if (compiled.methods.init) {
          compiled.methods.init();
        }

        if (compiled.methods.loop) {
          const wrappedLoop = function () {
            try {
              window.clearTelemetry();
              compiled.methods.loop();
              window.updateTelemetry();
            } catch (error) {
              showTelemetryError("loop() runtime error: " + error.message);
              window.stopExecution();
            }
          };
          if (loopHandler) loopHandler(wrappedLoop);
          else window._simStartLoop(wrappedLoop);
        }
        return true;
      }

      // Extract method bodies
      const initBody = getMethodBody(javaCode, "init");
      const loopBody = getMethodBody(javaCode, "loop");
      const classFields = extractClassFields(javaCode);
      const classScope = {};
      classFields.forEach(function (field) {
        classScope[field.name] = undefined;
      });

      // Transpile init
      if (initBody !== null) {
        const initJS = wrapWithClassFieldScope(
          transpileJava(initBody),
          classFields
        );
        try {
          const initFn = new Function(
            "gamepad",
            "hardwareMap",
            "addTelemetry",
            "updateTelemetry",
            "clearTelemetry",
            "getRuntime",
            "__scope",
            '"use strict";\n' + initJS
          );
          if (initHandler) {
            initHandler(function () {
              initFn(
                window.gamepad,
                window.hardwareMap,
                window.addTelemetry,
                window.updateTelemetry,
                window.clearTelemetry,
                window.getRuntime,
                classScope
              );
            });
          }
        } catch (e) {
          reportLifecycleError("init() compile/runtime error", e);
          return false;
        }
      }

      // Transpile loop
      if (loopBody !== null) {
        // Check for blocking loops
        if (detectBlockingLoop(loopBody)) {
          reportLifecycleError(
            "Java compile error",
            new Error("Blocking loop detected in loop()! Do not use while(gamepad...) or while(true) inside loop(). The loop() method is already called repeatedly.")
          );
          return false;
        }

        const loopJS = wrapWithClassFieldScope(
          transpileJava(loopBody),
          classFields
        );
        try {
          const loopFn = new Function(
            "gamepad",
            "hardwareMap",
            "addTelemetry",
            "updateTelemetry",
            "clearTelemetry",
            "getRuntime",
            "isStopRequested",
            "__scope",
            '"use strict";\n' + loopJS
          );
          let wrappedLoop = function () {
            try {
              // Clear telemetry for this frame
              window.clearTelemetry();
              loopFn(
                window.gamepad,
                window.hardwareMap,
                window.addTelemetry,
                window.updateTelemetry,
                window.clearTelemetry,
                window.getRuntime,
                window.isStopRequested,
                classScope
              );
              window.updateTelemetry();
            } catch (e) {
              showTelemetryError("loop() runtime error: " + e.message);
              window.stopExecution();
            }
          };

          if (loopHandler) {
            loopHandler(wrappedLoop);
          } else {
            // Start after the Driver Station Start button. If this was called
            // during Init, _simStartLoop stores the loop until Start is pressed.
            window._simStartLoop(wrappedLoop);
          }
        } catch (e) {
          reportLifecycleError("loop() compile error", e);
          return false;
        }
      }
      return true;
    } catch (e) {
      reportLifecycleError("Transpiler error", e);
      return false;
    }
  };

  /**
   * stopExecution() — clears the loop interval and stops execution.
   */
  window.stopExecution = function () {
    if (loopInterval) {
      clearInterval(loopInterval);
      loopInterval = null;
    }
    handleStop();
  };

  // Expose internal transpiler utilities for challenges that need custom control
  window._simTranspile = transpileJava;
  window._simGetMethodBody = getMethodBody;
  window._simDetectBlockingLoop = detectBlockingLoop;
  window._simShowTelemetryError = showTelemetryError;

  /**
   * Start a 20Hz loop that calls the provided function.
   * Returns the interval ID. Stored in loopInterval for stopExecution().
   */
  window._simStartLoop = function (fn) {
    if (loopInterval) clearInterval(loopInterval);
    loopInterval = null;
    if (!running) {
      pendingLoopFn = fn;
      return null;
    }
    loopInterval = setInterval(fn, 50);
    return loopInterval;
  };

  // ========================================================================
  // SECTION 9: HARDWARE MAP REGISTRY
  // ========================================================================
  // Mock hardware devices that fire callbacks when methods are called.
  // ========================================================================

  const hwCallbacks = {
    onMotorPower: [],
    onMotorVelocity: [],
    onBattery: [],
    onMotorDirection: [],
    onMotorMode: [],
    onMotorZeroPower: [],
    onServoPower: [],
    onServoPosition: [],
    onServoDirection: [],
    onCRServoPower: [],
    onTouchSensor: [],
    onColorSensor: [],
    onIMU: [],
    onVisionState: [],
  };

  /** Registry of mock devices by name */
  const hwDevices = {};
  let virtualBattery = null;

  function updateBatteryHud(state) {
    const value = document.getElementById("sim-battery-voltage");
    if (value && state) value.textContent = Number(state.terminalVoltage).toFixed(2);
  }

  function batteryWarning() {
    if (typeof window.addHint !== "function") return;
    window.addHint(
      '<i class="fa-solid fa-bolt"></i> An open-loop motor is losing speed as the battery drains. '
        + '<code>setPower()</code> requests a fraction of battery voltage; use '
        + '<code>DcMotorEx.setVelocity()</code> with tuned PIDF coefficients for consistent speed.',
      "warn"
    );
  }

  function ensureVirtualBattery() {
    if (virtualBattery) return virtualBattery;
    if (!window.TelemarkJava || typeof window.TelemarkJava.createBatteryModel !== "function") {
      throw new Error("Telemark battery model is unavailable");
    }
    virtualBattery = window.TelemarkJava.createBatteryModel({
      onChange: function (state) {
        updateBatteryHud(state);
        hwCallbacks.onBattery.forEach(function (callback) { callback(state); });
      },
      onWarning: batteryWarning,
    });
    return virtualBattery;
  }

  /**
   * Mock DcMotor
   */
  function MockDcMotor(name, type) {
    this._name = name;
    this._type = type === "DcMotorEx" ? "DcMotorEx" : "DcMotor";
    this._power = 0;
    this._requestedPower = 0;
    this._requestedVelocity = 0;
    this._measuredVelocity = 0;
    this._effectiveOutput = 0;
    this._controlMode = "power";
    this._pidf = { p: 10, i: 0, d: 0, f: 12 / 2800 };
    this._direction = "FORWARD";
    this._mode = "RUN_WITHOUT_ENCODER";
    this._zeroPowerBehavior = "BRAKE";
    this._currentPosition = 0;
    this._targetPosition = 0;
    this._ticksPerRev = 1120;
  }

  MockDcMotor.prototype.setPower = function (power) {
    this._requestedPower = Math.max(-1, Math.min(1, Number(power) || 0));
    this._power = this._requestedPower;
    this._controlMode = "power";
    hwCallbacks.onMotorPower.forEach(
      function (cb) {
        cb(this._name, this._power);
      }.bind(this)
    );
  };

  MockDcMotor.prototype.getPower = function () {
    return this._requestedPower;
  };

  MockDcMotor.prototype.setVelocity = function (velocity) {
    this._requestedVelocity = Number(velocity) || 0;
    this._controlMode = "velocity";
  };

  MockDcMotor.prototype.getVelocity = function () {
    return this._measuredVelocity;
  };

  MockDcMotor.prototype.setVelocityPIDFCoefficients = function (p, i, d, f) {
    this._pidf = {
      p: Number(p) || 0,
      i: Number(i) || 0,
      d: Number(d) || 0,
      f: Number(f) || 0,
    };
  };

  MockDcMotor.prototype.getVelocityPIDFCoefficients = function () {
    return Object.assign({}, this._pidf);
  };

  MockDcMotor.prototype.setDirection = function (dir) {
    this._direction = dir;
    hwCallbacks.onMotorDirection.forEach(
      function (cb) {
        cb(this._name, dir);
      }.bind(this)
    );
  };

  MockDcMotor.prototype.getDirection = function () {
    return this._direction;
  };

  MockDcMotor.prototype.setMode = function (mode) {
    this._mode = mode;
    if (mode === "STOP_AND_RESET_ENCODER") {
      this._currentPosition = 0;
      this._targetPosition = 0;
      this._measuredVelocity = 0;
      this._effectiveOutput = 0;
    }
    hwCallbacks.onMotorMode.forEach(
      function (cb) {
        cb(this._name, mode);
      }.bind(this)
    );
  };

  MockDcMotor.prototype.getMode = function () {
    return this._mode;
  };

  MockDcMotor.prototype.setZeroPowerBehavior = function (behavior) {
    this._zeroPowerBehavior = behavior;
    hwCallbacks.onMotorZeroPower.forEach(
      function (cb) {
        cb(this._name, behavior);
      }.bind(this)
    );
  };

  MockDcMotor.prototype.getCurrentPosition = function () {
    return this._currentPosition;
  };

  MockDcMotor.prototype.getMotorType = function () {
    return {
      getTicksPerRev: function () {
        return this._ticksPerRev;
      }.bind(this),
    };
  };

  MockDcMotor.prototype.setTargetPosition = function (pos) {
    this._targetPosition = pos;
  };

  MockDcMotor.prototype.isBusy = function () {
    return this._mode === "RUN_TO_POSITION"
      && Math.abs(this._targetPosition - this._currentPosition) > 4;
  };

  MockDcMotor.prototype._demand = function () {
    return {
      mode: this._controlMode,
      requestedPower: this._requestedPower,
      demand: Math.min(1, this._controlMode === "velocity"
        ? Math.abs(this._requestedVelocity) / 2800
        : Math.abs(this._requestedPower)),
    };
  };

  MockDcMotor.prototype._emitVelocity = function () {
    hwCallbacks.onMotorVelocity.forEach(
      function (callback) {
        callback(this._name, this._measuredVelocity, this._effectiveOutput, this._measuredVelocity / (2800 * 13 / 12));
      }.bind(this)
    );
  };

  MockDcMotor.prototype._halt = function () {
    this._measuredVelocity = 0;
    this._effectiveOutput = 0;
    this._emitVelocity();
  };

  MockDcMotor.prototype._tick = function (seconds, terminalVoltage) {
    const dt = Math.max(0, Math.min(0.1, Number(seconds) || 0));
    const availableVelocity = 2800 * (Number(terminalVoltage) || 13) / 12;
    let targetVelocity = this._controlMode === "velocity"
      ? Math.max(-availableVelocity, Math.min(availableVelocity, this._requestedVelocity))
      : this._requestedPower * availableVelocity;
    if (this._mode === "RUN_TO_POSITION") {
      const remaining = this._targetPosition - this._currentPosition;
      targetVelocity = Math.sign(remaining) * Math.abs(this._requestedPower) * availableVelocity;
    }
    const rate = Math.abs(targetVelocity) > Math.abs(this._measuredVelocity) ? 9000 : 11000;
    const difference = targetVelocity - this._measuredVelocity;
    const maximumChange = rate * dt;
    this._measuredVelocity += Math.abs(difference) <= maximumChange
      ? difference
      : Math.sign(difference) * maximumChange;
    this._effectiveOutput = availableVelocity > 0
      ? Math.max(-1, Math.min(1, this._measuredVelocity / availableVelocity))
      : 0;
    const step = this._measuredVelocity * dt;
    if (this._mode === "RUN_TO_POSITION" && Math.abs(this._targetPosition - this._currentPosition) <= Math.abs(step)) {
      this._currentPosition = this._targetPosition;
      this._measuredVelocity = 0;
      this._effectiveOutput = 0;
    } else {
      this._currentPosition += step;
    }
    this._emitVelocity();
  };

  /**
   * Mock Servo
   */
  function MockServo(name) {
    this._name = name;
    this._position = 0;
    this._physicalPosition = 0;
    this._scaleMin = 0;
    this._scaleMax = 1;
    this._direction = "FORWARD";
  }

  MockServo.prototype.setPosition = function (pos) {
    this._position = Math.max(0, Math.min(1, pos));
    this._physicalPosition =
      this._scaleMin + this._position * (this._scaleMax - this._scaleMin);
    hwCallbacks.onServoPosition.forEach(
      function (cb) {
        cb(this._name, this._position, this._physicalPosition);
      }.bind(this)
    );
  };

  MockServo.prototype.getPosition = function () {
    return this._position;
  };

  MockServo.prototype.getPhysicalPosition = function () {
    return this._physicalPosition;
  };

  MockServo.prototype.scaleRange = function (min, max) {
    min = Number(min);
    max = Number(max);
    if (!isFinite(min) || !isFinite(max)) return;
    if (typeof window.setServoScaleRange === "function") {
      window.setServoScaleRange(this._name, min, max);
    }
    if (min < 0 || max > 1 || min >= max) return;
    this._scaleMin = min;
    this._scaleMax = max;
    this._physicalPosition =
      this._scaleMin + this._position * (this._scaleMax - this._scaleMin);
  };

  MockServo.prototype.setDirection = function (dir) {
    this._direction = dir === "REVERSE" ? "REVERSE" : "FORWARD";
    hwCallbacks.onServoDirection.forEach(
      function (cb) {
        cb(this._name, this._direction);
      }.bind(this)
    );
  };

  MockServo.prototype.getDirection = function () {
    return this._direction;
  };

  /**
   * Mock CRServo (continuous rotation)
   */
  function MockCRServo(name) {
    this._name = name;
    this._power = 0;
    this._direction = "FORWARD";
  }

  MockCRServo.prototype.setPower = function (power) {
    this._power = Math.max(-1, Math.min(1, power));
    hwCallbacks.onCRServoPower.forEach(
      function (cb) {
        cb(this._name, this._power);
      }.bind(this)
    );
  };

  MockCRServo.prototype.getPower = function () {
    return this._power;
  };

  MockCRServo.prototype.setDirection = function (dir) {
    this._direction = dir;
  };

  /**
   * Mock TouchSensor
   */
  function MockTouchSensor(name) {
    this._name = name;
    this._pressed = false;
  }

  MockTouchSensor.prototype.isPressed = function () {
    return this._pressed;
  };

  // Allow challenges to set the pressed state
  MockTouchSensor.prototype._setPressed = function (val) {
    this._pressed = val;
    hwCallbacks.onTouchSensor.forEach(
      function (cb) {
        cb(this._name, val);
      }.bind(this)
    );
  };

  function MockDigitalChannel(name) {
    this._name = name;
    this._mode = "INPUT";
    this._state = true;
  }

  MockDigitalChannel.prototype.setMode = function (mode) { this._mode = mode; };
  MockDigitalChannel.prototype.getMode = function () { return this._mode; };
  MockDigitalChannel.prototype.getState = function () { return this._state; };
  MockDigitalChannel.prototype.setState = function (state) { this._state = Boolean(state); };
  MockDigitalChannel.prototype._setState = MockDigitalChannel.prototype.setState;

  function MockAnalogInput(name) {
    this._name = name;
    this._voltage = 1.65;
  }

  MockAnalogInput.prototype.getVoltage = function () { return this._voltage; };
  MockAnalogInput.prototype.getMaxVoltage = function () { return 3.3; };
  MockAnalogInput.prototype._setVoltage = function (voltage) {
    this._voltage = Math.max(0, Math.min(3.3, Number(voltage) || 0));
  };

  function MockDistanceSensor(name) {
    this._name = name;
    this._distanceInches = 24;
  }

  MockDistanceSensor.prototype.getDistance = function (unit) {
    const normalized = String(unit || "INCH").toUpperCase();
    if (normalized === "MM") return this._distanceInches * 25.4;
    if (normalized === "CM") return this._distanceInches * 2.54;
    if (normalized === "METER") return this._distanceInches * 0.0254;
    return this._distanceInches;
  };
  MockDistanceSensor.prototype._setDistance = function (inches) {
    this._distanceInches = Math.max(0, Number(inches) || 0);
  };

  /**
   * Mock ColorSensor
   */
  function MockColorSensor(name) {
    this._name = name;
    this._red = 0;
    this._green = 0;
    this._blue = 0;
    this._alpha = 0;
    this._argb = 0;
  }

  MockColorSensor.prototype.red = function () {
    return this._red;
  };
  MockColorSensor.prototype.green = function () {
    return this._green;
  };
  MockColorSensor.prototype.blue = function () {
    return this._blue;
  };
  MockColorSensor.prototype.alpha = function () {
    return this._alpha;
  };
  MockColorSensor.prototype.argb = function () {
    return this._argb;
  };

  // Allow challenges to set values
  MockColorSensor.prototype._setColor = function (r, g, b, a) {
    this._red = r;
    this._green = g;
    this._blue = b;
    this._alpha = a || 0;
    this._argb = ((a || 255) << 24) | (r << 16) | (g << 8) | b;
    hwCallbacks.onColorSensor.forEach(
      function (cb) {
        cb(this._name, { r: r, g: g, b: b, a: a });
      }.bind(this)
    );
  };

  /**
   * Mock IMU
   */
  function MockIMU(name) {
    this._name = name;
    this._heading = 0;
    this._physicalHeading = 0;
    this._yawOffset = 0;
    this._angularVelocity = { x: 0, y: 0, z: 0 };
    this._orientation = { heading: 0, pitch: 0, roll: 0 };
  }

  MockIMU.prototype.initialize = function () {};

  MockIMU.prototype.resetYaw = function () {
    this._yawOffset = this._physicalHeading;
    this._heading = 0;
  };

  MockIMU.prototype.getRobotYawPitchRollAngles = function () {
    const self = this;
    return {
      getYaw: function () {
        return self._heading;
      },
      getPitch: function () {
        return self._orientation.pitch;
      },
      getRoll: function () {
        return self._orientation.roll;
      },
    };
  };

  MockIMU.prototype.getRobotAngularVelocity = function () {
    return this._angularVelocity;
  };

  // Allow challenges to set heading
  MockIMU.prototype._setHeading = function (angle) {
    this._physicalHeading = Number(angle) || 0;
    this._heading = this._physicalHeading - this._yawOffset;
    hwCallbacks.onIMU.forEach(
      function (cb) {
        cb(this._name, { heading: this._heading });
      }.bind(this)
    );
  };

  function MockLimelight(name) {
    this._name = name;
    this._running = false;
    this._pipeline = 0;
  }

  MockLimelight.prototype.pipelineSwitch = function (pipeline) { this._pipeline = Number(pipeline) || 0; };
  MockLimelight.prototype.setPollRateHz = function () {};
  MockLimelight.prototype.start = function () {
    this._running = true;
    hwCallbacks.onVisionState.forEach(function (cb) { cb(this._name, true); }.bind(this));
  };
  MockLimelight.prototype.stop = function () {
    this._running = false;
    hwCallbacks.onVisionState.forEach(function (cb) { cb(this._name, false); }.bind(this));
  };
  MockLimelight.prototype.getLatestResult = function () {
    const running = this._running;
    return {
      isValid: function () { return running; },
      getTx: function () { return 0; },
      getTy: function () { return 0; },
      getBotpose: function () {
        return typeof window.Pose === "function" ? new window.Pose(0, 0, 0) : {x: 0, y: 0, heading: 0};
      },
    };
  };

  /**
   * The global hardwareMap object
   */
  window.hardwareMap = {
    _devices: hwDevices,

    registerMotor: function (name, type) {
      const motor = new MockDcMotor(name, type);
      hwDevices[name] = motor;
      return motor;
    },

    registerServo: function (name) {
      const servo = new MockServo(name);
      hwDevices[name] = servo;
      return servo;
    },

    registerCRServo: function (name) {
      const crServo = new MockCRServo(name);
      hwDevices[name] = crServo;
      return crServo;
    },

    registerTouchSensor: function (name) {
      const sensor = new MockTouchSensor(name);
      hwDevices[name] = sensor;
      return sensor;
    },

    registerColorSensor: function (name) {
      const sensor = new MockColorSensor(name);
      hwDevices[name] = sensor;
      return sensor;
    },

    registerDigitalChannel: function (name) {
      const sensor = new MockDigitalChannel(name);
      hwDevices[name] = sensor;
      return sensor;
    },

    registerAnalogInput: function (name) {
      const sensor = new MockAnalogInput(name);
      hwDevices[name] = sensor;
      return sensor;
    },

    registerDistanceSensor: function (name) {
      const sensor = new MockDistanceSensor(name);
      hwDevices[name] = sensor;
      return sensor;
    },

    registerLimelight: function (name) {
      const camera = new MockLimelight(name);
      hwDevices[name] = camera;
      return camera;
    },

    registerIMU: function (name) {
      const imu = new MockIMU(name);
      hwDevices[name] = imu;
      return imu;
    },

    /**
     * Intercepts hardwareMap.get(Type.class, "name") from transpiled code.
     * The transpiler converts Type.class to "Type" string.
     */
    get: function (type, name) {
      // If the device already exists, return it
      if (hwDevices[name]) return hwDevices[name];

      // Auto-register based on type string
      const typeStr = String(type).toLowerCase();
      if (typeStr.includes("dcmotor")) {
        return this.registerMotor(name, typeStr.includes("dcmotorex") ? "DcMotorEx" : "DcMotor");
      } else if (typeStr.includes("crservo")) {
        return this.registerCRServo(name);
      } else if (typeStr.includes("servo")) {
        return this.registerServo(name);
      } else if (typeStr.includes("touch")) {
        return this.registerTouchSensor(name);
      } else if (typeStr.includes("color")) {
        return this.registerColorSensor(name);
      } else if (typeStr.includes("digitalchannel")) {
        return this.registerDigitalChannel(name);
      } else if (typeStr.includes("analoginput")) {
        return this.registerAnalogInput(name);
      } else if (typeStr.includes("distancesensor")) {
        return this.registerDistanceSensor(name);
      } else if (typeStr.includes("imu")) {
        return this.registerIMU(name);
      } else if (typeStr.includes("limelight")) {
        return this.registerLimelight(name);
      } else if (typeStr.includes("webcam")) {
        hwDevices[name] = {_name: name, _type: "WebcamName"};
        return hwDevices[name];
      }

      // Fallback: create a generic motor
      console.warn(
        "[HardwareMap] Unknown type '" + type + "' for device '" + name + "', defaulting to DcMotor"
      );
      return this.registerMotor(name);
    },

    /**
     * Register callback: onMotorPower(callback)
     * callback receives (name, power)
     */
    onMotorPower: function (cb) {
      hwCallbacks.onMotorPower.push(cb);
    },
    onMotorVelocity: function (cb) {
      hwCallbacks.onMotorVelocity.push(cb);
    },
    onBattery: function (cb) {
      hwCallbacks.onBattery.push(cb);
    },
    onMotorDirection: function (cb) {
      hwCallbacks.onMotorDirection.push(cb);
    },
    onMotorMode: function (cb) {
      hwCallbacks.onMotorMode.push(cb);
    },
    onMotorZeroPower: function (cb) {
      hwCallbacks.onMotorZeroPower.push(cb);
    },
    onServoPosition: function (cb) {
      hwCallbacks.onServoPosition.push(cb);
    },
    onServoDirection: function (cb) {
      hwCallbacks.onServoDirection.push(cb);
    },
    onServoPower: function (cb) {
      hwCallbacks.onCRServoPower.push(cb);
    },
    onCRServoPower: function (cb) {
      hwCallbacks.onCRServoPower.push(cb);
    },
    onTouchSensor: function (cb) {
      hwCallbacks.onTouchSensor.push(cb);
    },
    onColorSensor: function (cb) {
      hwCallbacks.onColorSensor.push(cb);
    },
    onIMU: function (cb) {
      hwCallbacks.onIMU.push(cb);
    },
    onVisionState: function (cb) {
      hwCallbacks.onVisionState.push(cb);
    },

    tick: function (seconds, active) {
      const battery = ensureVirtualBattery();
      if (active === true) battery.start();
      else if (active === false) battery.stop();
      const motors = Object.keys(hwDevices).map(function (name) { return hwDevices[name]; }).filter(function (device) {
        return device instanceof MockDcMotor;
      });
      const batteryState = battery.tick(seconds, motors.map(function (motor) { return motor._demand(); }));
      motors.forEach(function (motor) { motor._tick(seconds, batteryState.terminalVoltage); });
      return batteryState;
    },

    resetBattery: function () {
      return ensureVirtualBattery().reset();
    },

    getBatteryState: function () {
      return ensureVirtualBattery().snapshot();
    },

    startBattery: function () {
      return ensureVirtualBattery().start();
    },

    stopBattery: function () {
      return ensureVirtualBattery().stop();
    },

    stopAll: function () {
      Object.keys(hwDevices).forEach(function (name) {
        const device = hwDevices[name];
        if (device instanceof MockDcMotor) {
          device.setPower(0);
          device._halt();
        } else if (device instanceof MockCRServo) device.setPower(0);
      });
    },

    /**
     * Clear all registered devices and callbacks.
     * Called between challenges or on reset.
     */
    clear: function () {
      for (const k in hwDevices) delete hwDevices[k];
      for (const k in hwCallbacks) hwCallbacks[k] = [];
      if (virtualBattery) virtualBattery.reset();
    },
  };

  // Also expose DcMotor direction and mode constants for transpiled code
  window.DcMotor = {
    Direction: {
      FORWARD: "FORWARD",
      REVERSE: "REVERSE",
    },
    RunMode: {
      RUN_WITHOUT_ENCODER: "RUN_WITHOUT_ENCODER",
      RUN_USING_ENCODER: "RUN_USING_ENCODER",
      RUN_TO_POSITION: "RUN_TO_POSITION",
      STOP_AND_RESET_ENCODER: "STOP_AND_RESET_ENCODER",
    },
    ZeroPowerBehavior: {
      BRAKE: "BRAKE",
      FLOAT: "FLOAT",
    },
  };
  window.DcMotorEx = window.DcMotor;

  // Expose DcMotorSimple for direction
  window.DcMotorSimple = {
    Direction: {
      FORWARD: "FORWARD",
      REVERSE: "REVERSE",
    },
  };

  // Expose Servo direction
  window.Servo = {
    Direction: {
      FORWARD: "FORWARD",
      REVERSE: "REVERSE",
    },
  };

  window.DigitalChannel = {
    Mode: {
      INPUT: "INPUT",
      OUTPUT: "OUTPUT",
    },
  };

  // Expose AngleUnit for IMU
  window.AngleUnit = {
    DEGREES: "DEGREES",
    RADIANS: "RADIANS",
  };

  // ========================================================================
  // SECTION 10: HARDWARE BADGE STRIP
  // ========================================================================

  /**
   * setBadges(array) — sets the hardware badge strip.
   * Each item: { iconClass: "fa-solid fa-gear", label: "DcMotor", active: true/false }
   */
  window.setBadges = function (badges) {
    const strip = document.getElementById("sim-badge-strip");
    if (!strip) return;

    strip.innerHTML = "";
    badges.forEach(function (badge) {
      const div = el("div", {
        className: "sim-hw-badge " + (badge.active ? "active" : "inactive"),
      });
      const iconHtml = badge.iconClass
        ? '<i class="' + escHTML(badge.iconClass) + '"></i>'
        : '<span style="font-size:0.9rem">' + escHTML(badge.icon || "") + "</span>";
      div.innerHTML = iconHtml + " " + escHTML(badge.label);

      // Allow an ID for dynamic updates
      if (badge.id) div.id = badge.id;

      strip.appendChild(div);
    });
  };

  // ========================================================================
  // SECTION 11: CHALLENGE INSTRUCTIONS PANEL
  // ========================================================================

  let challengeRequirements = [];
  let challengeRequirementStates = [];
  let challengeCompleteCallback = null;
  let challengeHintRules = [];
  let challengeWasComplete = false;
  let challengeFaultModes = [];
  let activeFaultId = "";
  let challengeCompilationOk = null;
  let challengeCompilationEvidence = "";
  let challengeGradingScope = "";
  const GRADING_OVERRIDE_STORAGE_KEY = "telemark:grading-overrides:v1";

  function requirementId(requirement, index) {
    if (requirement && typeof requirement === "object" && requirement.id) {
      return String(requirement.id);
    }
    const label = typeof requirement === "string" ? requirement : requirement && requirement.label || "requirement";
    const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    return "legacy-" + index + "-" + (slug || "requirement");
  }

  function normalizeRequirement(requirement, index) {
    return {
      id: requirementId(requirement, index),
      label: typeof requirement === "string" ? requirement : String(requirement && requirement.label || "Requirement " + (index + 1)),
    };
  }

  function gradingScopeFor(config) {
    const project = config.projectKey || "legacy-project";
    const lesson = config.lessonId || (window.location && window.location.pathname) || "simulator";
    return project + "::" + lesson;
  }

  function readGradingOverrides() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(GRADING_OVERRIDE_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeGradingOverrides(overrides) {
    try {
      window.localStorage.setItem(GRADING_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
    } catch (_) {
      // Storage can be unavailable in embedded/private contexts; grading still works for this page.
    }
  }

  function storedOverride(id) {
    const scope = readGradingOverrides()[challengeGradingScope] || {};
    return scope[id] === "done" || scope[id] === "not-done" ? scope[id] : "auto";
  }

  function saveOverride(id, choice) {
    const all = readGradingOverrides();
    const scope = Object.assign({}, all[challengeGradingScope] || {});
    if (choice === "auto") delete scope[id];
    else scope[id] = choice;
    if (Object.keys(scope).length) all[challengeGradingScope] = scope;
    else delete all[challengeGradingScope];
    writeGradingOverrides(all);
  }

  function effectiveRequirement(state) {
    if (challengeCompilationOk === false) return false;
    if (state.manual === "not-done") return false;
    if (state.automatic) return true;
    return state.manual === "done" && challengeCompilationOk === true;
  }

  function renderRequirement(index) {
    const state = challengeRequirementStates[index];
    const reqEl = document.getElementById("sim-req-" + index);
    if (!state || !reqEl) return;
    state.effective = effectiveRequirement(state);
    const check = reqEl.querySelector(".sim-check");
    if (check) check.className = "sim-check " + (state.effective ? "pass" : "fail");
  }

  function compileCurrentChallenge() {
    try {
      const editor = document.getElementById("sim-code-editor") || document.getElementById("code-editor");
      const source = editor && editor.__telemarkProject ? editor.__telemarkProject.source() : editor && editor.value || "";
      const result = compileStudentSource(source);
      challengeCompilationOk = Boolean(result.ok);
      challengeCompilationEvidence = result.ok ? "Project compiles." : String(result.diagnostics && result.diagnostics[0] && result.diagnostics[0].message || "Project does not compile.");
    } catch (error) {
      challengeCompilationOk = false;
      challengeCompilationEvidence = String(error && error.message || "Project does not compile.");
    }
  }

  function gradingEvidence(state) {
    if (challengeCompilationOk === false) return "Compile error: " + challengeCompilationEvidence;
    if (state.manual === "done" && !state.automatic) return "Marked done after a successful project compile.";
    if (state.manual === "not-done") return "Manually marked not done.";
    return state.evidence || (state.automatic ? "Automatic grading passed." : "Automatic grading has not passed yet.");
  }

  function closeGradingDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function renderGradingDialog() {
    let dialog = document.getElementById("sim-grading-dialog");
    if (!dialog) {
      const host = document.body || document.documentElement;
      if (!host) return null;
      dialog = document.createElement("dialog");
      dialog.id = "sim-grading-dialog";
      dialog.className = "sim-grading-dialog";
      dialog.setAttribute("aria-labelledby", "sim-grading-dialog-title");
      host.appendChild(dialog);
    }
    dialog.innerHTML = '<div class="sim-grading-dialog-inner">'
      + '<h2 id="sim-grading-dialog-title">Review grading</h2>'
      + '<p class="sim-grading-dialog-intro">Use Auto normally. Choose Done when correct work was missed, or Not done when an automatic pass is incorrect. Compile errors cannot be overridden.</p>'
      + '<div class="sim-grading-options">'
      + challengeRequirementStates.map(function (state, index) {
        const name = "sim-grading-choice-" + index;
        return '<section class="sim-grading-option" data-criterion-id="' + escHTML(state.id) + '">'
          + '<span class="sim-grading-option-title">' + escHTML(state.label) + '</span>'
          + '<div class="sim-grading-choice-row" role="radiogroup" aria-label="Review ' + escHTML(state.label) + '">'
          + [
              ["auto", "Auto"],
              ["done", "Done"],
              ["not-done", "Not done"],
            ].map(function (choice) {
              return '<label><input type="radio" name="' + name + '" value="' + choice[0] + '" data-requirement-index="' + index + '"'
                + (state.manual === choice[0] ? ' checked' : '') + '> ' + choice[1] + '</label>';
            }).join("")
          + '</div><div class="sim-grading-evidence" id="sim-grading-evidence-' + index + '">' + escHTML(gradingEvidence(state)) + '</div></section>';
      }).join("")
      + '</div><div class="sim-grading-dialog-actions">'
      + '<button type="button" id="sim-grading-reset">Reset all to Auto</button>'
      + '<button type="button" id="sim-grading-close">Close</button>'
      + '</div></div>';

    dialog.onchange = function (event) {
      const input = event.target && event.target.closest && event.target.closest("[data-requirement-index]");
      if (!input) return;
      window.setRequirementOverride(Number(input.dataset.requirementIndex), input.value);
    };
    const reset = dialog.querySelector("#sim-grading-reset");
    if (reset) reset.onclick = function () {
      challengeRequirementStates.forEach(function (state) {
        state.manual = "auto";
        saveOverride(state.id, "auto");
      });
      challengeRequirementStates.forEach(function (_state, index) { renderRequirement(index); });
      checkAllRequirements();
      renderGradingDialog();
    };
    const close = dialog.querySelector("#sim-grading-close");
    if (close) close.onclick = function () { closeGradingDialog(dialog); };
    return dialog;
  }

  function openGradingDialog() {
    const dialog = renderGradingDialog();
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  /**
   * setChallenge(title, description, requirements)
   * setChallenge({title, scenario, requirements, successMessage, hints, faultModes, onComplete})
   * The positional signature remains supported for existing lesson adapters.
   */
  window.setChallenge = function (title, description, requirements) {
    const config = typeof title === "object" && title !== null
      ? title
      : {
          title: title,
          scenario: description,
          requirements: requirements,
        };
    const headerTitle = document.getElementById("sim-header-title");
    const headerSub = document.getElementById("sim-header-sub");
    const titleText = document.getElementById("sim-challenge-title-text");
    const desc = document.getElementById("sim-challenge-desc");
    const reqList = document.getElementById("sim-requirements-list");
    const banner = document.getElementById("sim-success-banner");

    if (headerTitle) headerTitle.textContent = config.title || "Simulator Challenge";
    if (headerSub) headerSub.textContent = config.scenario || config.description || "";
    if (titleText) titleText.innerHTML = '<i class="fa-solid fa-trophy" style="margin-right:4px"></i> ' + escHTML(config.title || "Simulator Challenge");
    if (desc) desc.innerHTML = config.scenario || config.description || "";
    if (banner) {
      banner.classList.remove("visible");
      banner.innerHTML = '<i class="fa-solid fa-circle-check"></i> '
        + escHTML(config.successMessage || "Challenge Complete!");
    }

    challengeRequirements = (config.requirements || []).map(normalizeRequirement);
    challengeGradingScope = gradingScopeFor(config);
    challengeCompilationOk = null;
    challengeCompilationEvidence = "";
    challengeRequirementStates = challengeRequirements.map(function (requirement) {
      return {
        id: requirement.id,
        label: requirement.label,
        automatic: false,
        manual: storedOverride(requirement.id),
        effective: false,
        evidence: "",
      };
    });
    challengeCompleteCallback = typeof config.onComplete === "function"
      ? config.onComplete
      : null;
    challengeHintRules = Array.isArray(config.hints) ? config.hints : [];
    challengeWasComplete = false;
    window.setFaultModes(config.faultModes || []);

    if (reqList) {
      reqList.innerHTML = "";
      challengeRequirements.forEach(function (req, idx) {
        const div = el("div", { className: "sim-req", id: "sim-req-" + idx });
        div.innerHTML =
          '<span class="sim-check fail"><i class="fa-solid fa-check"></i></span> ' + escHTML(req.label);
        reqList.appendChild(div);
      });
    }
    const review = document.getElementById("sim-grading-review-button");
    if (review) {
      review.hidden = challengeRequirements.length === 0;
      review.onclick = openGradingDialog;
    }
    renderGradingDialog();
  };

  window.setFaultModes = function (faultModes) {
    challengeFaultModes = Array.isArray(faultModes) ? faultModes : [];
    activeFaultId = "";
    const control = document.getElementById("sim-fault-control");
    const select = document.getElementById("sim-fault-select");
    const description = document.getElementById("sim-fault-description");
    if (!control || !select || !description) return;

    control.classList.toggle("visible", challengeFaultModes.length > 0);
    select.innerHTML = "";
    const normal = document.createElement("option");
    normal.value = "";
    normal.textContent = "Normal robot";
    select.appendChild(normal);

    challengeFaultModes.forEach(function (fault) {
      const option = document.createElement("option");
      option.value = fault.id;
      option.textContent = fault.label;
      select.appendChild(option);
    });
    description.textContent = "No injected fault. Behavior is deterministic.";

    select.onchange = function () {
      activeFaultId = select.value;
      const active = challengeFaultModes.find(function (fault) {
        return fault.id === activeFaultId;
      });
      description.textContent = active
        ? active.description || "A repeatable robot fault is active."
        : "No injected fault. Behavior is deterministic.";
      handleStop();
      if (typeof window.onFaultModeChange === "function") {
        window.onFaultModeChange(activeFaultId, active || null);
      }
      if (active) {
        window.addHint(
          '<i class="fa-solid fa-screwdriver-wrench"></i> Fault enabled: '
            + escHTML(active.label) + ". Reinitialize before testing.",
          "info"
        );
      }
    };
  };

  window.getActiveFault = function () {
    return activeFaultId;
  };

  window.isFaultActive = function (faultId) {
    return activeFaultId === faultId;
  };

  window.createSeededRandom = function (seed) {
    let state = (Number(seed) || 1) >>> 0;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };

  window.evaluateChallengeHints = function (context) {
    challengeHintRules.forEach(function (rule) {
      if (!rule || typeof rule.when !== "function" || !rule.when(context)) return;
      window.addHint(escHTML(rule.message || ""), rule.type || "warn");
    });
  };

  /**
   * setRequirement(index, passed) — turns requirement green or red.
   */
  window.setRequirement = function (index, passed, evidence) {
    const state = challengeRequirementStates[index];
    if (!state) return;
    state.automatic = Boolean(passed);
    state.evidence = evidence == null ? state.evidence : String(evidence);
    if (state.manual === "done" && challengeCompilationOk === null) compileCurrentChallenge();
    renderRequirement(index);
    checkAllRequirements();
  };

  window.setChallengeCompilation = function (passed, evidence) {
    challengeCompilationOk = Boolean(passed);
    challengeCompilationEvidence = evidence == null ? "" : String(evidence);
    challengeRequirementStates.forEach(function (_state, index) { renderRequirement(index); });
    checkAllRequirements();
    const dialog = document.getElementById("sim-grading-dialog");
    if (dialog && dialog.hasAttribute("open")) renderGradingDialog();
  };

  window.setRequirementOverride = function (index, choice) {
    const state = challengeRequirementStates[index];
    if (!state || ["auto", "done", "not-done"].indexOf(choice) < 0) return;
    if (choice === "done") compileCurrentChallenge();
    state.manual = choice;
    saveOverride(state.id, choice);
    challengeRequirementStates.forEach(function (_state, stateIndex) { renderRequirement(stateIndex); });
    checkAllRequirements();
    renderGradingDialog();
  };

  window.resetRequirementOverrides = function () {
    challengeRequirementStates.forEach(function (state, index) {
      state.manual = "auto";
      saveOverride(state.id, "auto");
      renderRequirement(index);
    });
    checkAllRequirements();
    renderGradingDialog();
  };

  window.getRequirementState = function (index) {
    const state = challengeRequirementStates[index];
    return state ? Object.assign({}, state) : null;
  };

  function checkAllRequirements() {
    let allPass = true;
    for (let i = 0; i < challengeRequirements.length; i++) {
      const state = challengeRequirementStates[i];
      if (!state || !state.effective) {
        allPass = false;
        break;
      }
    }

    const banner = document.getElementById("sim-success-banner");
    if (allPass && challengeRequirements.length > 0) {
      if (banner) banner.classList.add("visible");
      if (!challengeWasComplete) {
        challengeWasComplete = true;
        if (challengeCompleteCallback) challengeCompleteCallback();
        if (typeof window.onChallengeComplete === "function") {
          window.onChallengeComplete();
        }
      }
    } else {
      challengeWasComplete = false;
      if (banner) banner.classList.remove("visible");
    }
  }

  // ========================================================================
  // SECTION 12: THREE.JS SCENE BASE
  // ========================================================================
  // Loads Three.js, creates renderer/scene/camera, orbit controls,
  // field plane, perimeter walls, lights, animation loop.
  // ========================================================================

  let threeScene = null;
  let threeCamera = null;
  let threeRenderer = null;
  let threeGrid = null;
  let animationFrameId = null;
  let fieldMeshes = []; // floor + walls for setFieldVisible

  /** Default orbit state */
  const defaultOrbit = {
    theta: 0.4,
    phi: 0.75,
    radius: 6,
    target: { x: 0, y: 0.2, z: 0 },
  };

  const orbit = {
    theta: defaultOrbit.theta,
    phi: defaultOrbit.phi,
    radius: defaultOrbit.radius,
    target: { x: defaultOrbit.target.x, y: defaultOrbit.target.y, z: defaultOrbit.target.z },
    dragging: false,
    panning: false,
    prevX: 0,
    prevY: 0,
  };

  function setMaterialColor(material, hex) {
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach(function (entry) {
      if (entry && entry.color && typeof entry.color.setHex === "function") {
        entry.color.setHex(hex);
        entry.needsUpdate = true;
      }
    });
  }

  function recolorGrid(grid, theme) {
    if (!grid || !grid.geometry || !window.THREE) return;
    const position = grid.geometry.getAttribute && grid.geometry.getAttribute("position");
    const color = grid.geometry.getAttribute && grid.geometry.getAttribute("color");
    if (!position || !color || typeof color.setXYZ !== "function") {
      setMaterialColor(grid.material, theme === "light" ? 0x88a8b8 : 0x243746);
      return;
    }
    const centerColor = new THREE.Color(theme === "light" ? 0x5e879b : 0x39556a);
    const lineColor = new THREE.Color(theme === "light" ? 0xa9c0cc : 0x243746);
    for (let index = 0; index < position.count; index += 2) {
      const centerLine =
        (Math.abs(position.getX(index)) < 0.0001 && Math.abs(position.getX(index + 1)) < 0.0001) ||
        (Math.abs(position.getZ(index)) < 0.0001 && Math.abs(position.getZ(index + 1)) < 0.0001);
      const next = centerLine ? centerColor : lineColor;
      color.setXYZ(index, next.r, next.g, next.b);
      if (index + 1 < position.count) color.setXYZ(index + 1, next.r, next.g, next.b);
    }
    color.needsUpdate = true;
  }

  function applyThreeTheme(theme, explicitScene) {
    const nextTheme = normalizeTheme(theme);
    const targetScene = explicitScene || threeScene || window.scene;
    if (!targetScene || !window.THREE) return nextTheme;
    if (targetScene.background && typeof targetScene.background.setHex === "function") {
      targetScene.background.setHex(nextTheme === "light" ? 0xeaf1f5 : 0x050508);
    } else {
      targetScene.background = new THREE.Color(nextTheme === "light" ? 0xeaf1f5 : 0x050508);
    }

    if (typeof targetScene.traverse === "function") {
      targetScene.traverse(function (object) {
        const role = object && object.userData && object.userData.telemarkThemeRole;
        const rotationX = object && object.rotation ? Number(object.rotation.x) || 0 : 0;
        const isHorizontalPlane = Boolean(
          object && object.isMesh && object.geometry && object.geometry.type === "PlaneGeometry" &&
          Math.abs(Math.abs(Math.sin(rotationX)) - 1) < 0.02
        );
        if (role === "floor" || isHorizontalPlane) {
          setMaterialColor(object.material, nextTheme === "light" ? 0xdce8ee : 0x1a1a2e);
        } else if (role === "wall") {
          setMaterialColor(object.material, nextTheme === "light" ? 0xb8ccd6 : 0x151520);
        } else if (role === "grid" || object === threeGrid || object.isGridHelper || object.type === "GridHelper") {
          recolorGrid(object, nextTheme);
        } else if (role === "ambient" || object.isAmbientLight) {
          if (object.color && object.color.setHex) object.color.setHex(nextTheme === "light" ? 0xffffff : 0x404050);
          object.intensity = nextTheme === "light" ? 1.05 : 0.6;
        } else if (role === "directional" || object.isDirectionalLight) {
          object.intensity = nextTheme === "light" ? 0.75 : 0.9;
        }
      });
    }
    if (threeRenderer && targetScene === threeScene && threeRenderer.render) {
      threeRenderer.render(threeScene, threeCamera);
    }
    return nextTheme;
  }

  function loadThreeJS(callback) {
    const script = document.createElement("script");
    let finished = false;
    const finish = function () {
      if (finished) return;
      finished = true;
      if (callback) callback();
    };
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = finish;
    script.onerror = finish;
    document.head.appendChild(script);
  }

  function showGraphicsFallback(message) {
    const container = document.getElementById("sim-scene-container");
    const canvas = document.getElementById("sim-robot-canvas");
    if (canvas) canvas.style.display = "none";
    if (!container || document.getElementById("sim-graphics-fallback")) return;
    const fallback = el("div", {id: "sim-graphics-fallback"});
    fallback.style.cssText = [
      "height:100%",
      "display:grid",
      "place-items:center",
      "padding:24px",
      "color:#aeb4c0",
      "font:0.85rem/1.6 var(--font-ui)",
      "text-align:center",
      "background:#08080c",
    ].join(";");
    fallback.innerHTML = '<div><strong style="display:block;color:#ffb547;margin-bottom:8px">3D view unavailable</strong>'
      + escHTML(message)
      + '<br>The editor, telemetry, requirements, and hints still work.</div>';
    container.appendChild(fallback);
  }

  function updateCameraOrbit() {
    if (!threeCamera) return;
    const o = orbit;
    threeCamera.position.x =
      o.target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta);
    threeCamera.position.y = o.target.y + o.radius * Math.cos(o.phi);
    threeCamera.position.z =
      o.target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta);
    threeCamera.lookAt(o.target.x, o.target.y, o.target.z);
  }

  function initThreeScene() {
    const container = document.getElementById("sim-scene-container");
    const canvas = document.getElementById("sim-robot-canvas");
    if (!container || !canvas || !window.THREE) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x050508);

    threeCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    updateCameraOrbit();

    threeRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    threeRenderer.setSize(w, h);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.shadowMap.enabled = true;

    // ── Lights ──
    const ambient = new THREE.AmbientLight(0x404050, 0.6);
    ambient.userData.telemarkThemeRole = "ambient";
    threeScene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.userData.telemarkThemeRole = "directional";
    dirLight.position.set(3, 6, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    threeScene.add(dirLight);

    // ── Floor ──
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.userData.telemarkThemeRole = "floor";
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    threeScene.add(floor);
    fieldMeshes.push(floor);

    threeGrid = new THREE.GridHelper(8, 16, 0x39556a, 0x243746);
    threeGrid.position.y = 0.005;
    threeGrid.userData.telemarkThemeRole = "grid";
    threeScene.add(threeGrid);
    fieldMeshes.push(threeGrid);

    // ── Perimeter Walls ──
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x151520 });
    const wallGeoH = new THREE.BoxGeometry(8, 0.6, 0.1);
    const wallGeoV = new THREE.BoxGeometry(0.1, 0.6, 8);

    [-1, 1].forEach(function (s) {
      const w1 = new THREE.Mesh(wallGeoH, wallMat);
      w1.userData.telemarkThemeRole = "wall";
      w1.position.set(0, 0.3, s * 4);
      threeScene.add(w1);
      fieldMeshes.push(w1);

      const w2 = new THREE.Mesh(wallGeoV, wallMat);
      w2.userData.telemarkThemeRole = "wall";
      w2.position.set(s * 4, 0.3, 0);
      threeScene.add(w2);
      fieldMeshes.push(w2);
    });

    // ── Orbit Controls ──
    wireOrbitControls(canvas);

    // ── Window Resize ──
    window.addEventListener("resize", function () {
      if (!container || !threeCamera || !threeRenderer) return;
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      threeCamera.aspect = w2 / h2;
      threeCamera.updateProjectionMatrix();
      threeRenderer.setSize(w2, h2);
    });

    // Expose globally
    window.scene = threeScene;
    window.camera = threeCamera;
    window.renderer = threeRenderer;

    applyThreeTheme(activeTheme || detectInitialTheme(), threeScene);

    // Start animation loop
    startAnimationLoop();
  }

  function wireOrbitControls(canvas) {
    canvas.addEventListener("pointerdown", function (e) {
      if (e.button === 0) {
        orbit.dragging = true;
        orbit.panning = false;
      } else if (e.button === 1 || e.button === 2) {
        orbit.dragging = false;
        orbit.panning = true;
      }
      orbit.prevX = e.clientX;
      orbit.prevY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!orbit.dragging && !orbit.panning) return;

      const dx = e.clientX - orbit.prevX;
      const dy = e.clientY - orbit.prevY;
      orbit.prevX = e.clientX;
      orbit.prevY = e.clientY;

      if (orbit.dragging) {
        orbit.theta -= dx * 0.008;
        orbit.phi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, orbit.phi - dy * 0.008)
        );
      }

      if (orbit.panning && threeCamera) {
        const panSpeed = 0.005 * orbit.radius;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        right.setFromMatrixColumn(threeCamera.matrixWorld, 0);
        up.setFromMatrixColumn(threeCamera.matrixWorld, 1);

        orbit.target.x -= right.x * dx * panSpeed + up.x * dy * panSpeed;
        orbit.target.y -= right.y * dx * panSpeed + up.y * dy * panSpeed;
        orbit.target.z -= right.z * dx * panSpeed + up.z * dy * panSpeed;
        orbit.target.y = Math.max(-0.5, orbit.target.y);
      }

      updateCameraOrbit();
    });

    function releaseOrbit() {
      orbit.dragging = false;
      orbit.panning = false;
    }
    canvas.addEventListener("pointerup", releaseOrbit);
    canvas.addEventListener("pointercancel", releaseOrbit);
    canvas.addEventListener("lostpointercapture", releaseOrbit);
    window.addEventListener("blur", releaseOrbit);

    canvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        orbit.radius = Math.max(
          1.5,
          Math.min(15, orbit.radius + e.deltaY * 0.008)
        );
        updateCameraOrbit();
      },
      { passive: false }
    );

    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  /** Custom animation callbacks that challenges can register */
  const animationCallbacks = [];

  function startAnimationLoop() {
    function animate() {
      animationFrameId = requestAnimationFrame(animate);

      // Run any registered animation callbacks
      for (let i = 0; i < animationCallbacks.length; i++) {
        try {
          animationCallbacks[i]();
        } catch (e) {
          console.error("[Animation callback error]", e);
        }
      }

      if (threeRenderer && threeScene && threeCamera) {
        threeRenderer.render(threeScene, threeCamera);
      }
    }
    animate();
  }

  /**
   * Register a callback to run on each animation frame (60fps).
   * Returns an ID that can be used to remove it.
   */
  window.addAnimationCallback = function (fn) {
    animationCallbacks.push(fn);
    return animationCallbacks.length - 1;
  };

  /**
   * Remove an animation callback by ID.
   */
  window.removeAnimationCallback = function (id) {
    if (id >= 0 && id < animationCallbacks.length) {
      animationCallbacks[id] = function () {}; // no-op to preserve indices
    }
  };

  /**
   * resetCamera() — return to default orbit view.
   */
  window.resetCamera = function () {
    orbit.theta = defaultOrbit.theta;
    orbit.phi = defaultOrbit.phi;
    orbit.radius = defaultOrbit.radius;
    orbit.target.x = defaultOrbit.target.x;
    orbit.target.y = defaultOrbit.target.y;
    orbit.target.z = defaultOrbit.target.z;
    updateCameraOrbit();
  };

  window.setCameraOrbit = function (options) {
    options = options || {};
    if (typeof options.theta === "number") orbit.theta = options.theta;
    if (typeof options.phi === "number") orbit.phi = options.phi;
    if (typeof options.radius === "number") orbit.radius = options.radius;
    if (options.target) {
      if (typeof options.target.x === "number") orbit.target.x = options.target.x;
      if (typeof options.target.y === "number") orbit.target.y = options.target.y;
      if (typeof options.target.z === "number") orbit.target.z = options.target.z;
    }
    updateCameraOrbit();
  };

  /**
   * setFieldVisible(bool) — hide/show field plane and walls.
   */
  window.setFieldVisible = function (visible) {
    fieldMeshes.forEach(function (mesh) {
      mesh.visible = visible;
    });
  };

  // ========================================================================
  // SECTION 13: CONSOLE ERROR CAPTURE
  // ========================================================================
  // Catches uncaught errors from student code and displays them in
  // telemetry rather than crashing the page.
  // ========================================================================

  window.addEventListener("error", function (event) {
    showTelemetryError(
      (event.message || "Unknown error") +
        (event.lineno ? " (line " + event.lineno + ")" : "")
    );
    // Prevent default browser error handling
    event.preventDefault();
  });

  window.addEventListener("unhandledrejection", function (event) {
    showTelemetryError(
      "Unhandled promise rejection: " +
        (event.reason ? event.reason.message || event.reason : "Unknown")
    );
    event.preventDefault();
  });

  // ========================================================================
  // SECTION 14: ADDITIONAL EXPOSED UTILITIES
  // ========================================================================

  /**
   * Set the panel header title and subtitle.
   */
  window.setHeader = function (title, subtitle) {
    const t = document.getElementById("sim-header-title");
    const s = document.getElementById("sim-header-sub");
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle || "";
  };

  /**
   * Add a hint message below the telemetry panel.
   * type: 'warn' (default), 'error', 'info'
   */
  window.addHint = function (message, type) {
    const container = document.getElementById("sim-hint-container");
    if (!container) return;
    const normalizedType = type || "warn";
    const key = normalizedType + "::" + String(message).replace(/\s+/g, " ").trim();
    for (let i = 0; i < container.children.length; i++) {
      if (container.children[i].getAttribute("data-sim-hint-key") === key) {
        return;
      }
    }

    const maxHints = 4;
    while (container.children.length >= maxHints) {
      container.removeChild(container.firstElementChild);
    }

    const div = el("div", {
      className: "sim-hint" + (type === "error" ? " error" : type === "info" ? " info" : ""),
    });
    div.setAttribute("data-sim-hint-key", key);
    div.innerHTML = message;
    container.appendChild(div);
  };

  /**
   * Clear all hints.
   */
  window.clearHints = function () {
    const container = document.getElementById("sim-hint-container");
    if (container) container.innerHTML = "";
  };

  /**
   * ResizeObserver for the scene container to handle panel resize
   */
  function observeSceneResize() {
    const container = document.getElementById("sim-scene-container");
    if (!container || !window.ResizeObserver) return;

    const ro = new ResizeObserver(function () {
      if (!threeCamera || !threeRenderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      threeCamera.aspect = w / h;
      threeCamera.updateProjectionMatrix();
      threeRenderer.setSize(w, h);
    });
    ro.observe(container);
  }

  // ========================================================================
  // SECTION 15: INITIALIZATION
  // ========================================================================
  // On DOMContentLoaded, build the entire UI, load dependencies, then
  // call window.onSimulatorReady() so the challenge can configure itself.
  // ========================================================================

  function initialize() {
    applyTheme(activeTheme || detectInitialTheme());

    // 1. Inject CSS
    injectCSS();

    // 2. Build DOM
    buildDOM();

    // 3. Load dependencies and then init scene + editor highlighting
    let prismReady = false;
    let threeReady = false;

    function checkReady() {
      if (prismReady && threeReady) {
        // Initialize Three.js scene
        try {
          if (!window.THREE) {
            throw new Error("The graphics library could not be loaded.");
          }
          initThreeScene();
        } catch (graphicsError) {
          console.warn("[Simulator graphics fallback]", graphicsError);
          threeScene = null;
          threeCamera = null;
          threeRenderer = null;
          window.scene = null;
          window.camera = null;
          window.renderer = null;
          showGraphicsFallback(
            graphicsError && graphicsError.message
              ? graphicsError.message
              : "WebGL is unavailable in this browser."
          );
          startAnimationLoop();
        }

        // Observe resize
        observeSceneResize();

        // Initial code highlighting
        updateHighlighting();
        syncScroll();
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(function () {
            updateHighlighting();
            syncScroll();
          });
        }

        // Call the challenge's onSimulatorReady callback
        if (typeof window.onSimulatorReady === "function") {
          try {
            window.onSimulatorReady();
            // Challenge callbacks commonly add their own floor/grid or replace
            // the scene background, so theme the completed scene as well.
            applyThreeTheme(activeTheme || detectInitialTheme());
          } catch (e) {
            console.error("[onSimulatorReady error]", e);
            showTelemetryError("Setup error: " + e.message);
          }
        }

        // Most lessons set a starter through setCode(), which restores their
        // matching draft there. This fallback covers generated lessons that
        // deliberately leave the editor content in the base template.
        const editor = document.getElementById("sim-code-editor");
        if (editor && !editor.__telemarkInitialCodeSet && window.TelemarkEditor) {
          editor.__telemarkInitialCodeSet = true;
          window.TelemarkEditor.restoreDraft(editor);
          updateHighlighting();
          syncScroll();
        }
        if (editor && window.TelemarkProject) {
          window.TelemarkProject.attach(editor);
        }
      }
    }

    loadPrism(function () {
      prismReady = true;
      checkReady();
    });

    loadThreeJS(function () {
      threeReady = true;
      checkReady();
    });
  }

  function initializeLegacy() {
    applyTheme(activeTheme || detectInitialTheme());
    preventNativeControllerDrag(document);
  }

  // Wait for DOMContentLoaded
  const initializeForMode = isLegacyMode ? initializeLegacy : initialize;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeForMode);
  } else {
    // DOM already loaded (e.g., script loaded with defer or at end of body)
    initializeForMode();
  }
})();
