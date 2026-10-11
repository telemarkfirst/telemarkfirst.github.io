(function (global) {
  "use strict";

  const COLUMNS = 24;
  const ROW_HEIGHT = 32;
  const GAP = 4;
  const MAX_ROWS = 96;
  const STORAGE_KEY = "telemark:sim-layout:v2:shared";
  const LEGACY_STORAGE_PREFIX = "telemark:sim-layout:v1:";
  const RECORD_KEYS = [
    "height",
    "identifier",
    "position_x",
    "position_y",
    "tab_group",
    "width",
  ];
  let activeWorkspace = null;

  function integer(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function copyRecord(record) {
    return {
      identifier: String(record.identifier),
      position_x: integer(record.position_x, 0),
      position_y: integer(record.position_y, 0),
      width: integer(record.width, 1),
      height: integer(record.height, 1),
      tab_group: record.tab_group == null ? null : String(record.tab_group),
    };
  }

  // Robot-view and non-Three lesson-output tiles occupy the same reusable
  // workspace slot. Keeping that identity stable lets a layout follow the
  // learner between every simulator even when the rendered widget differs.
  function layoutSlot(identifier) {
    const value = String(identifier || "");
    return value === "robot_view" || value === "lesson_output" ? "lesson_output" : value;
  }

  function scaleLegacyRecord(record) {
    const scaled = copyRecord(record);
    scaled.position_x *= 2;
    scaled.position_y *= 2;
    scaled.width *= 2;
    scaled.height *= 2;
    return scaled;
  }

  function normalizeBounds(bounds) {
    const value = bounds || {};
    const minWidth = clamp(integer(value.minWidth, 2), 1, COLUMNS);
    const maxWidth = clamp(integer(value.maxWidth, COLUMNS), minWidth, COLUMNS);
    const minHeight = clamp(integer(value.minHeight, 2), 1, MAX_ROWS);
    const maxHeight = clamp(integer(value.maxHeight, 18), minHeight, MAX_ROWS);
    return {
      minWidth: minWidth,
      maxWidth: maxWidth,
      minHeight: minHeight,
      maxHeight: maxHeight,
    };
  }

  function normalizePosition(position, bounds) {
    const value = position || {};
    const width = clamp(integer(value.width, bounds.minWidth), bounds.minWidth, bounds.maxWidth);
    const height = clamp(integer(value.height, bounds.minHeight), bounds.minHeight, bounds.maxHeight);
    return {
      position_x: clamp(integer(value.position_x, integer(value.x, 0)), 0, COLUMNS - width),
      position_y: clamp(integer(value.position_y, integer(value.y, 0)), 0, MAX_ROWS - height),
      width: width,
      height: height,
      tab_group: value.tab_group == null ? null : String(value.tab_group),
    };
  }

  function overlaps(first, second) {
    return first.position_x < second.position_x + second.width
      && first.position_x + first.width > second.position_x
      && first.position_y < second.position_y + second.height
      && first.position_y + first.height > second.position_y;
  }

  function sameContext(first, second) {
    return (first.tab_group || null) === (second.tab_group || null);
  }

  function collides(candidate, records, ignoredIdentifier) {
    return records.some(function (record) {
      return record.identifier !== ignoredIdentifier
        && sameContext(candidate, record)
        && overlaps(candidate, record);
    });
  }

  function exactRecordShape(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    const keys = Object.keys(record).sort();
    if (keys.length !== RECORD_KEYS.length) return false;
    return keys.every(function (key, index) { return key === RECORD_KEYS[index]; });
  }

  function registryGet(registry, identifier) {
    if (!registry) return null;
    if (typeof registry.get === "function") return registry.get(identifier) || null;
    return registry[identifier] || null;
  }

  function validateLayout(records, registry, options) {
    const settings = options || {};
    const maxRows = integer(settings.maxRows, MAX_ROWS);
    if (!Array.isArray(records)) {
      return {ok: false, error: "A simulator layout must be an array."};
    }

    const normalized = [];
    const identifiers = new Set();
    for (let index = 0; index < records.length; index += 1) {
      const raw = records[index];
      if (!exactRecordShape(raw)) {
        return {ok: false, error: "Layout entry " + (index + 1) + " must contain exactly the six documented fields."};
      }
      const identifier = typeof raw.identifier === "string" ? raw.identifier : "";
      const definition = registryGet(registry, identifier);
      if (!identifier || !definition) {
        return {ok: false, error: "Unknown simulator widget: " + (identifier || "(blank)") + "."};
      }
      if (identifiers.has(identifier)) {
        return {ok: false, error: "A widget can appear only once: " + identifier + "."};
      }
      identifiers.add(identifier);

      const numericKeys = ["position_x", "position_y", "width", "height"];
      if (!numericKeys.every(function (key) { return Number.isInteger(raw[key]); })) {
        return {ok: false, error: "Widget coordinates and dimensions must be whole grid units."};
      }
      if (raw.tab_group !== null && typeof raw.tab_group !== "string") {
        return {ok: false, error: "tab_group must be a string or null."};
      }

      const bounds = normalizeBounds(definition.bounds);
      if (raw.width < bounds.minWidth || raw.width > bounds.maxWidth
          || raw.height < bounds.minHeight || raw.height > bounds.maxHeight) {
        return {ok: false, error: identifier + " is outside its size limits."};
      }
      if (raw.position_x < 0 || raw.position_y < 0
          || raw.position_x + raw.width > COLUMNS
          || raw.position_y + raw.height > maxRows) {
        return {ok: false, error: identifier + " is outside the layout grid."};
      }
      if (raw.tab_group) {
        const separator = raw.tab_group.indexOf("/");
        const groupIdentifier = separator > 0 ? raw.tab_group.slice(0, separator) : "";
        const tabIdentifier = separator > 0 ? raw.tab_group.slice(separator + 1) : "";
        const groupDefinition = registryGet(registry, groupIdentifier);
        if (!groupDefinition || groupDefinition.kind !== "tabs" || !tabIdentifier) {
          return {ok: false, error: identifier + " references an unknown tab group."};
        }
        if (typeof settings.tabExists === "function" && !settings.tabExists(groupIdentifier, tabIdentifier)) {
          return {ok: false, error: identifier + " references an unknown tab."};
        }
      }

      normalized.push(copyRecord(raw));
    }

    for (let index = 0; index < normalized.length; index += 1) {
      const record = normalized[index];
      if (!record.tab_group) continue;
      const groupIdentifier = record.tab_group.slice(0, record.tab_group.indexOf("/"));
      const groupRecord = normalized.find(function (candidate) {
        return candidate.identifier === groupIdentifier && candidate.tab_group === null;
      });
      if (!groupRecord) {
        return {ok: false, error: record.identifier + " references a tab container that is not in the layout."};
      }
    }

    return {ok: true, records: normalized};
  }

  function referencedTabs(records) {
    const references = new Map();
    if (!Array.isArray(records)) return references;
    records.forEach(function (record) {
      if (!record || typeof record.tab_group !== "string") return;
      const separator = record.tab_group.indexOf("/");
      if (separator <= 0 || separator === record.tab_group.length - 1) return;
      const groupIdentifier = record.tab_group.slice(0, separator);
      const tabIdentifier = record.tab_group.slice(separator + 1);
      if (!references.has(groupIdentifier)) references.set(groupIdentifier, new Set());
      references.get(groupIdentifier).add(tabIdentifier);
    });
    return references;
  }

  function firstOpenSlot(records, width, height, tabGroup, maxRows) {
    const candidate = {
      identifier: "__candidate__",
      position_x: 0,
      position_y: 0,
      width: width,
      height: height,
      tab_group: tabGroup || null,
    };
    const rowLimit = integer(maxRows, MAX_ROWS);
    for (let y = 0; y <= rowLimit - height; y += 1) {
      for (let x = 0; x <= COLUMNS - width; x += 1) {
        candidate.position_x = x;
        candidate.position_y = y;
        if (!collides(candidate, records, null)) return copyRecord(candidate);
      }
    }
    return null;
  }

  function pointToCell(rect, clientX, clientY, pointerOffset, maxRows) {
    const offset = pointerOffset || {x: 0, y: 0};
    const cellWidth = (rect.width - GAP * (COLUMNS - 1)) / COLUMNS;
    const pitchX = cellWidth + GAP;
    const pitchY = ROW_HEIGHT + GAP;
    const x = Math.round((clientX - rect.left - offset.x) / pitchX);
    const y = Math.round((clientY - rect.top - offset.y) / pitchY);
    return {
      x: clamp(x, 0, COLUMNS - 1),
      y: clamp(y, 0, integer(maxRows, MAX_ROWS) - 1),
      cellWidth: cellWidth,
      pitchX: pitchX,
      pitchY: pitchY,
    };
  }

  function resizeRecord(record, bounds, edge, deltaColumns, deltaRows, maxRows) {
    const candidate = copyRecord(record);
    const left = edge === "top-left" || edge === "bottom-left";
    const right = edge === "right" || edge === "top-right" || edge === "bottom-right";
    const top = edge === "top-left" || edge === "top-right";
    const bottom = edge === "bottom" || edge === "bottom-left" || edge === "bottom-right";
    if (left) {
      const fixedRight = record.position_x + record.width;
      candidate.position_x = clamp(record.position_x + deltaColumns,
        Math.max(0, fixedRight - bounds.maxWidth), fixedRight - bounds.minWidth);
      candidate.width = fixedRight - candidate.position_x;
    } else if (right) {
      candidate.width = clamp(record.width + deltaColumns, bounds.minWidth,
        Math.min(bounds.maxWidth, COLUMNS - record.position_x));
    }
    if (top) {
      const fixedBottom = record.position_y + record.height;
      candidate.position_y = clamp(record.position_y + deltaRows,
        Math.max(0, fixedBottom - bounds.maxHeight), fixedBottom - bounds.minHeight);
      candidate.height = fixedBottom - candidate.position_y;
    } else if (bottom) {
      candidate.height = clamp(record.height + deltaRows, bounds.minHeight,
        Math.min(bounds.maxHeight, maxRows - record.position_y));
    }
    return candidate;
  }

  function resizeNarrowRecord(record, bounds, edge, deltaRows) {
    const candidate = copyRecord(record);
    const fromTop = edge === "top-left" || edge === "top-right";
    candidate.height = clamp(record.height + (fromTop ? -deltaRows : deltaRows),
      bounds.minHeight, bounds.maxHeight);
    return candidate;
  }

  function svgIcon(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"></path></svg>';
  }

  function makeButton(documentObject, className, label, iconPath) {
    const button = documentObject.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = svgIcon(iconPath);
    return button;
  }

  function scheduleFrame(callback) {
    const request = typeof global.requestAnimationFrame === "function"
      ? global.requestAnimationFrame.bind(global)
      : function (next) { return global.setTimeout(next, 0); };
    return request(callback);
  }

  function cancelFrame(frame) {
    if (frame == null) return;
    if (typeof global.cancelAnimationFrame === "function") {
      global.cancelAnimationFrame(frame);
      return;
    }
    global.clearTimeout(frame);
  }

  function dispatchResize() {
    if (typeof global.dispatchEvent !== "function") return;
    if (typeof global.Event === "function") {
      global.dispatchEvent(new global.Event("resize"));
      return;
    }
    const doc = global.document;
    if (doc && typeof doc.createEvent === "function") {
      const event = doc.createEvent("Event");
      event.initEvent("resize", false, false);
      global.dispatchEvent(event);
    }
  }

  function emitVisibility(workspace, identifier, active, reason) {
    const definition = workspace.registry.get(identifier);
    const node = definition && definition.node;
    const detail = {identifier: identifier, active: active, reason: reason};
    if (node && typeof global.CustomEvent === "function") {
      node.dispatchEvent(new global.CustomEvent("telemark:widget-visibility", {detail: detail}));
    }
    if (typeof global.CustomEvent === "function") {
      global.dispatchEvent(new global.CustomEvent("telemark:widget-visibility", {detail: detail}));
    }
  }

  function Workspace(options) {
    const settings = options || {};
    if (!settings.root || !settings.root.ownerDocument) {
      throw new Error("The simulator workspace requires a DOM root.");
    }
    this.root = settings.root;
    this.document = this.root.ownerDocument;
    this.lessonId = String(settings.lessonId || (global.location && global.location.pathname) || "simulator");
    this.collision = "overlap";
    this.maxRows = clamp(integer(settings.maxRows, MAX_ROWS), 24, 192);
    this.registry = new Map();
    this.records = [];
    this.stackOrder = [];
    this.narrowOrder = [];
    this.defaultRecords = [];
    this.lastRecords = new Map();
    this.frames = new Map();
    this.lifecycle = new Map();
    this.lifecycleState = new Map();
    this.lifecycleMounted = new Set();
    this.available = new Set();
    this.tabState = new Map();
    this.defaultTabs = new Map();
    this.activeTabs = new Map();
    this.userMutated = false;
    this.dragState = null;
    this.destroyed = false;
    this.initialized = false;
    this.originals = [];
    this.dormantNodes = [];
    this.outsidePointerHandler = null;
    this.documentPointerMoveHandler = null;
    this.documentPointerUpHandler = null;
    this.documentPointerCancelHandler = null;
    this.keydownHandler = null;
    this.visibilityHandler = null;
    this.viewportHandler = null;
    this.fullscreenHandler = null;
    this.messageHandler = null;
    this.storageHandler = null;
    this.visualViewport = null;
    this.resizeObserver = null;
    this.measureFrame = null;
    this.contentResizeFrame = null;
    this.fullscreenSettleTimer = null;
    this.gamepadFitters = new Map();
    this.buildShell();
    (settings.dormantNodes || []).forEach(function (node) {
      if (!node || !node.setAttribute) return;
      this.dormantNodes.push({
        node: node,
        ariaHidden: node.getAttribute("aria-hidden"),
        inert: Boolean(node.inert),
      });
      node.setAttribute("data-sim-workspace-dormant", "true");
      node.setAttribute("aria-hidden", "true");
      node.inert = true;
    }, this);
    this.registerTabController();
    (settings.widgets || []).forEach(this.registerWidget.bind(this));
    this.loadPersistedOrDefault();
    this.render();
    this.bindGlobalEvents();
    this.initialized = true;
  }

  Workspace.prototype.storageKey = function () {
    return STORAGE_KEY;
  };

  Workspace.prototype.buildShell = function () {
    const doc = this.document;
    doc.documentElement.setAttribute("data-sim-workspace", "true");

    this.scroll = doc.createElement("div");
    this.scroll.id = "sim-dashboard-scroll";

    this.toolbar = doc.createElement("div");
    this.toolbar.className = "sim-widget-toolbar";
    this.scroll.appendChild(this.toolbar);

    this.grid = doc.createElement("section");
    this.grid.id = "sim-dashboard";
    this.grid.className = "sim-dashboard-grid";
    this.grid.setAttribute("role", "region");
    this.grid.setAttribute("aria-label", "Resizable lesson workspace");
    this.scroll.appendChild(this.grid);

    this.emptyState = doc.createElement("div");
    this.emptyState.className = "sim-workspace-empty";
    this.emptyState.hidden = true;
    this.emptyState.innerHTML = "<strong>No panels are open.</strong><span>Use Add panel to restore one for this lesson.</span>";
    this.grid.appendChild(this.emptyState);

    this.vault = doc.createElement("div");
    this.vault.id = "sim-widget-vault";
    this.vault.hidden = true;

    this.liveRegion = doc.createElement("div");
    this.liveRegion.className = "sim-workspace-live";
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");

    this.palette = doc.createElement("div");
    this.palette.className = "sim-widget-palette";
    this.palette.hidden = true;
    this.palette.setAttribute("role", "menu");
    this.palette.setAttribute("aria-label", "Add a panel");

    this.addButton = makeButton(doc, "sim-widget-add", "Add panel", "M12 5v14M5 12h14");
    this.addButton.setAttribute("aria-expanded", "false");
    this.addButton.setAttribute("aria-controls", "sim-widget-palette");
    const addLabel = doc.createElement("span");
    addLabel.className = "sim-widget-add-label";
    addLabel.textContent = "Add panel";
    this.addButton.appendChild(addLabel);
    this.palette.id = "sim-widget-palette";

    this.root.appendChild(this.scroll);
    this.root.appendChild(this.vault);
    this.root.appendChild(this.liveRegion);
    this.toolbar.appendChild(this.addButton);
    this.toolbar.appendChild(this.palette);

    const self = this;
    this.addButton.addEventListener("click", function () { self.togglePalette(); });
  };

  Workspace.prototype.registerTabController = function () {
    const doc = this.document;
    const node = doc.createElement("div");
    node.className = "sim-tab-controller";
    this.registerWidget({
      identifier: "tab_group",
      title: "Tabbed group",
      category: "hardware",
      kind: "tabs",
      node: node,
      bounds: {minWidth: 8, minHeight: 8, maxWidth: 24, maxHeight: 48},
      position: {position_x: 3, position_y: 2, width: 14, height: 12, tab_group: null},
      initiallyVisible: false,
      tabs: [
        {id: "tab-1", label: "Tab 1"},
        {id: "tab-2", label: "Tab 2"},
      ],
    });
  };

  Workspace.prototype.registerWidget = function (definition) {
    if (!definition || !definition.identifier) throw new Error("A widget identifier is required.");
    const identifier = String(definition.identifier);
    if (this.registry.has(identifier)) return this.registry.get(identifier);
    const bounds = normalizeBounds(definition.bounds);
    const position = normalizePosition(definition.position, bounds);
    const normalized = Object.assign({}, definition, {
      identifier: identifier,
      title: String(definition.title || identifier),
      category: definition.category === "software" ? "software" : "hardware",
      kind: definition.kind === "tabs" ? "tabs" : "widget",
      bounds: bounds,
      position: position,
      node: definition.node || null,
    });
    if (!normalized.node && typeof normalized.factory === "function") {
      normalized.node = normalized.factory();
    }
    if (!normalized.node) throw new Error("Widget " + identifier + " requires an existing node or factory.");

    this.registry.set(identifier, normalized);
    this.available.add(identifier);
    this.originals.push({
      node: normalized.node,
      parent: normalized.node.parentNode,
      nextSibling: normalized.node.nextSibling,
    });
    const record = copyRecord(Object.assign({identifier: identifier}, position));
    this.defaultRecords.push(record);
    this.lastRecords.set(identifier, copyRecord(record));
    if (normalized.kind === "tabs") {
      const tabs = Array.isArray(definition.tabs) && definition.tabs.length
        ? definition.tabs.map(function (tab, index) {
          return {id: String(tab.id || "tab-" + (index + 1)), label: String(tab.label || "Tab " + (index + 1))};
        })
        : [{id: "tab-1", label: "Tab 1"}];
      this.tabState.set(identifier, tabs);
      this.defaultTabs.set(identifier, tabs.map(function (tab) { return Object.assign({}, tab); }));
      this.activeTabs.set(identifier, tabs[0].id);
    }
    if (definition.initiallyVisible !== false && !this.records.some(function (item) { return item.identifier === identifier; })) {
      let initialRecord = record;
      if (this.initialized && collides(initialRecord, this.records, null)) {
        const open = firstOpenSlot(this.records, record.width, record.height, record.tab_group, this.maxRows);
        if (open) {
          open.identifier = identifier;
          initialRecord = open;
        } else {
          initialRecord = null;
        }
      }
      if (initialRecord) this.records.push(copyRecord(initialRecord));
    }
    if (this.initialized) {
      this.loadPersistedOrDefault();
      this.render();
    } else if (this.grid) {
      this.updatePalette();
    }
    return normalized;
  };

  Workspace.prototype.tabExists = function (groupIdentifier, tabIdentifier) {
    const tabs = this.tabState.get(groupIdentifier) || [];
    return tabs.some(function (tab) { return tab.id === tabIdentifier; });
  };

  Workspace.prototype.loadPersistedOrDefault = function () {
    let envelope = null;
    let migratedLegacy = false;
    try {
      envelope = JSON.parse(global.localStorage.getItem(this.storageKey()) || "null");
      if (!envelope) {
        envelope = JSON.parse(global.localStorage.getItem(LEGACY_STORAGE_PREFIX + this.lessonId) || "null");
        migratedLegacy = !!envelope;
      }
    } catch (_) {}
    this.defaultTabs.forEach(function (tabs, groupIdentifier) {
      this.tabState.set(groupIdentifier, tabs.map(function (tab) { return Object.assign({}, tab); }));
      if (tabs[0]) this.activeTabs.set(groupIdentifier, tabs[0].id);
    }, this);
    const storedTabs = envelope && !Array.isArray(envelope) && envelope.tabs;
    if (storedTabs && typeof storedTabs === "object") {
      Object.keys(storedTabs).forEach(function (groupIdentifier) {
        const definition = this.registry.get(groupIdentifier);
        const candidates = storedTabs[groupIdentifier];
        if (!definition || definition.kind !== "tabs" || !Array.isArray(candidates)) return;
        const seen = new Set();
        const tabs = candidates.map(function (tab, index) {
          const id = tab && typeof tab.id === "string" ? tab.id.trim() : "";
          const label = tab && typeof tab.label === "string" ? tab.label.trim() : "";
          if (!id || seen.has(id)) return null;
          seen.add(id);
          return {id: id, label: label || "Tab " + (index + 1)};
        }).filter(Boolean);
        if (tabs.length) this.tabState.set(groupIdentifier, tabs);
      }, this);
    }
    const rawRecords = Array.isArray(envelope) ? envelope : envelope && envelope.layout;
    const storedRecords = Array.isArray(rawRecords)
      ? rawRecords.filter(exactRecordShape).map(function (record) {
        return migratedLegacy ? scaleLegacyRecord(record) : copyRecord(record);
      })
      : [];
    const recordsBySlot = new Map();
    storedRecords.forEach(function (record) { recordsBySlot.set(layoutSlot(record.identifier), record); });
    // The original three-panel preset predates the separate requirements and
    // execution panels. Upgrade that untouched preset so all five panels fit
    // together; retain every position in a learner's customized layout.
    const originalPreset = [
      ["coding", 0, 0, 14, 20],
      ["lesson_output", 14, 0, 10, 12],
      ["gamepad", 14, 12, 10, 8],
    ];
    const upgradedOriginalPreset = this.registry.has("requirements")
      && this.registry.has("execution")
      && !recordsBySlot.has("requirements")
      && !recordsBySlot.has("execution")
      && storedRecords.length === originalPreset.length
      && originalPreset.every(function (preset) {
        const record = recordsBySlot.get(preset[0]);
        return record && record.position_x === preset[1] && record.position_y === preset[2]
          && record.width === preset[3] && record.height === preset[4]
          && record.tab_group === null;
      });
    if (upgradedOriginalPreset) {
      originalPreset.forEach(function (preset) { recordsBySlot.delete(preset[0]); });
    }
    const hiddenSlots = new Set(
      envelope && !Array.isArray(envelope) && Array.isArray(envelope.hidden)
        ? envelope.hidden.map(layoutSlot)
        : []
    );
    if (migratedLegacy) {
      this.defaultRecords.forEach(function (record) {
        const slot = layoutSlot(record.identifier);
        if (!recordsBySlot.has(slot) && slot !== "requirements" && slot !== "execution"
            && !upgradedOriginalPreset) hiddenSlots.add(slot);
      });
    }

    const nextRecords = [];
    const orderedDefaults = this.defaultRecords.slice().sort(function (a, b) {
      return Number(recordsBySlot.has(layoutSlot(b.identifier)))
        - Number(recordsBySlot.has(layoutSlot(a.identifier)));
    });
    orderedDefaults.forEach(function (defaultRecord) {
      const definition = this.registry.get(defaultRecord.identifier);
      if (!definition) return;
      const slot = layoutSlot(defaultRecord.identifier);
      const stored = recordsBySlot.get(slot);
      const bounds = definition.bounds;
      let candidate = stored ? copyRecord(stored) : copyRecord(defaultRecord);
      candidate.identifier = defaultRecord.identifier;
      candidate.width = clamp(candidate.width, bounds.minWidth, bounds.maxWidth);
      candidate.height = clamp(candidate.height, bounds.minHeight, bounds.maxHeight);
      candidate.position_x = clamp(candidate.position_x, 0, COLUMNS - candidate.width);
      candidate.position_y = clamp(candidate.position_y, 0, this.maxRows - candidate.height);
      this.lastRecords.set(defaultRecord.identifier, copyRecord(candidate));
      if (hiddenSlots.has(slot) || !stored && definition.initiallyVisible === false) return;

      if (candidate.tab_group) {
        const separator = candidate.tab_group.indexOf("/");
        const groupIdentifier = separator > 0 ? candidate.tab_group.slice(0, separator) : "";
        const tabIdentifier = separator > 0 ? candidate.tab_group.slice(separator + 1) : "";
        const groupPresent = nextRecords.some(function (record) {
          return record.identifier === groupIdentifier && record.tab_group === null;
        });
        if (!groupPresent || !this.tabExists(groupIdentifier, tabIdentifier)) candidate.tab_group = null;
      }
      // Keep newly introduced panels apart on their first appearance. A
      // learner's saved overlaps are intentional and must survive reloads.
      if (!stored && collides(candidate, nextRecords, null)) {
        candidate = copyRecord(defaultRecord);
        if (collides(candidate, nextRecords, null)) {
          const open = firstOpenSlot(nextRecords, candidate.width, candidate.height, candidate.tab_group, this.maxRows);
          if (!open) return;
          open.identifier = candidate.identifier;
          candidate = open;
        }
      }
      nextRecords.push(candidate);
    }, this);

    const validation = validateLayout(nextRecords, this.registry, {
      maxRows: this.maxRows,
      tabExists: this.tabExists.bind(this),
    });
    this.records = validation.ok
      ? validation.records
      : this.defaultRecords.filter(function (record) {
        const definition = this.registry.get(record.identifier);
        return definition && definition.initiallyVisible !== false;
      }, this).map(copyRecord);

    const storedStack = envelope && !Array.isArray(envelope) && Array.isArray(envelope.stack)
      ? envelope.stack.map(layoutSlot)
      : [];
    const idsBySlot = new Map(this.records.map(function (record) {
      return [layoutSlot(record.identifier), record.identifier];
    }));
    this.stackOrder = [];
    storedStack.forEach(function (slot) {
      const identifier = idsBySlot.get(slot);
      if (identifier && !this.stackOrder.includes(identifier)) this.stackOrder.push(identifier);
    }, this);
    this.records.forEach(function (record) {
      if (!this.stackOrder.includes(record.identifier)) this.stackOrder.push(record.identifier);
    }, this);

    const storedNarrowOrder = envelope && !Array.isArray(envelope) && Array.isArray(envelope.narrow_order)
      ? envelope.narrow_order.map(layoutSlot)
      : [];
    this.narrowOrder = [];
    storedNarrowOrder.forEach(function (slot) {
      const identifier = idsBySlot.get(slot);
      if (identifier && !this.narrowOrder.includes(identifier)) this.narrowOrder.push(identifier);
    }, this);
    this.records.forEach(function (record) {
      if (!this.narrowOrder.includes(record.identifier)) this.narrowOrder.push(record.identifier);
    }, this);

    const activeTabs = envelope && !Array.isArray(envelope) && envelope.active_tabs;
    if (activeTabs && typeof activeTabs === "object") {
      const self = this;
      Object.keys(activeTabs).forEach(function (groupIdentifier) {
        if (self.tabExists(groupIdentifier, activeTabs[groupIdentifier])) {
          self.activeTabs.set(groupIdentifier, activeTabs[groupIdentifier]);
        }
      });
    }
    if (migratedLegacy || upgradedOriginalPreset) this.save();
  };

  Workspace.prototype.save = function () {
    let previous = null;
    try {
      previous = JSON.parse(global.localStorage.getItem(this.storageKey()) || "null");
    } catch (_) {}
    const previousLayout = previous && !Array.isArray(previous) && Array.isArray(previous.layout)
      ? previous.layout.filter(exactRecordShape).map(copyRecord)
      : [];
    const scopedSlots = new Set();
    this.available.forEach(function (identifier) {
      if (this.registry.has(identifier)) scopedSlots.add(layoutSlot(identifier));
    }, this);
    const layout = previousLayout.filter(function (record) {
      return !scopedSlots.has(layoutSlot(record.identifier));
    });
    this.records.forEach(function (record) {
      if (this.available.has(record.identifier)) layout.push(copyRecord(record));
    }, this);

    const previousStack = previous && !Array.isArray(previous) && Array.isArray(previous.stack)
      ? previous.stack.filter(function (identifier) { return typeof identifier === "string"; })
      : [];
    const stack = previousStack.filter(function (identifier) {
      return !scopedSlots.has(layoutSlot(identifier));
    });
    this.stackOrder.forEach(function (identifier) {
      if (this.records.some(function (record) { return record.identifier === identifier; })
          && !stack.includes(identifier)) stack.push(identifier);
    }, this);
    this.records.forEach(function (record) {
      if (!stack.includes(record.identifier)) stack.push(record.identifier);
    });

    const previousNarrowOrder = previous && !Array.isArray(previous) && Array.isArray(previous.narrow_order)
      ? previous.narrow_order.filter(function (identifier) { return typeof identifier === "string"; })
      : [];
    const narrowOrder = previousNarrowOrder.filter(function (identifier) {
      return !scopedSlots.has(layoutSlot(identifier));
    });
    this.narrowOrder.forEach(function (identifier) {
      if (this.records.some(function (record) { return record.identifier === identifier; })
          && !narrowOrder.includes(identifier)) narrowOrder.push(identifier);
    }, this);
    this.records.forEach(function (record) {
      if (!narrowOrder.includes(record.identifier)) narrowOrder.push(record.identifier);
    });

    const hidden = new Set(
      previous && !Array.isArray(previous) && Array.isArray(previous.hidden)
        ? previous.hidden.map(layoutSlot)
        : []
    );
    scopedSlots.forEach(function (slot) { hidden.delete(slot); });
    scopedSlots.forEach(function (slot) {
      const visible = this.records.some(function (record) { return layoutSlot(record.identifier) === slot; });
      if (!visible) hidden.add(slot);
    }, this);

    const activeTabs = Object.assign({}, previous && previous.active_tabs || {});
    const tabs = Object.assign({}, previous && previous.tabs || {});
    this.activeTabs.forEach(function (value, key) { activeTabs[key] = value; });
    this.tabState.forEach(function (value, key) {
      tabs[key] = value.map(function (tab) { return {id: tab.id, label: tab.label}; });
    });
    try {
      global.localStorage.setItem(this.storageKey(), JSON.stringify({
        version: 2,
        grid: {columns: COLUMNS, row_height: ROW_HEIGHT, gap: GAP},
        layout: layout,
        hidden: Array.from(hidden),
        active_tabs: activeTabs,
        tabs: tabs,
        stack: stack,
        narrow_order: narrowOrder,
      }));
    } catch (_) {}
  };

  Workspace.prototype.markMutated = function () {
    this.userMutated = true;
    this.save();
  };

  Workspace.prototype.setLessonId = function (lessonId) {
    const next = String(lessonId || "simulator");
    if (next === this.lessonId) return true;
    if (this.userMutated) this.save();
    this.lessonId = next;
    this.userMutated = false;
    this.loadPersistedOrDefault();
    this.render();
    return true;
  };

  Workspace.prototype.getLayout = function () {
    return this.records.map(copyRecord);
  };

  Workspace.prototype.exportLayout = function () {
    return JSON.stringify(this.getLayout(), null, 2);
  };

  Workspace.prototype.importLayout = function (payload) {
    let parsed = payload;
    try {
      if (typeof payload === "string") parsed = JSON.parse(payload);
    } catch (_) {
      this.announce("That file is not valid layout JSON.");
      return false;
    }
    const references = referencedTabs(parsed);
    const self = this;
    const validation = validateLayout(parsed, this.registry, {
      maxRows: this.maxRows,
      tabExists: function (groupIdentifier, tabIdentifier) {
        return self.tabExists(groupIdentifier, tabIdentifier)
          || references.has(groupIdentifier) && references.get(groupIdentifier).has(tabIdentifier);
      },
    });
    if (!validation.ok) {
      this.announce(validation.error);
      return false;
    }
    references.forEach(function (tabIdentifiers, groupIdentifier) {
      const tabs = this.tabState.get(groupIdentifier) || [];
      tabIdentifiers.forEach(function (tabIdentifier) {
        if (tabs.some(function (tab) { return tab.id === tabIdentifier; })) return;
        const number = /^tab-(\d+)$/.exec(tabIdentifier);
        tabs.push({
          id: tabIdentifier,
          label: number ? "Tab " + number[1] : tabIdentifier.replace(/[-_]+/g, " "),
        });
      });
      this.tabState.set(groupIdentifier, tabs);
    }, this);
    this.records = validation.records;
    this.records.forEach(function (record) { this.lastRecords.set(record.identifier, copyRecord(record)); }, this);
    this.markMutated();
    this.render();
    this.announce("Layout imported.");
    return true;
  };

  Workspace.prototype.setLayout = function (records) {
    return this.importLayout(records);
  };

  Workspace.prototype.resetLayout = function () {
    this.records = this.defaultRecords
      .filter(function (record) {
        const definition = this.registry.get(record.identifier);
        return definition && definition.initiallyVisible !== false && this.available.has(record.identifier);
      }, this)
      .map(copyRecord);
    this.stackOrder = this.records.map(function (record) { return record.identifier; });
    this.narrowOrder = this.records.map(function (record) { return record.identifier; });
    this.defaultTabs.forEach(function (defaultTabs, groupIdentifier) {
      const tabs = defaultTabs.map(function (tab) { return Object.assign({}, tab); });
      this.tabState.set(groupIdentifier, tabs);
      if (tabs[0]) this.activeTabs.set(groupIdentifier, tabs[0].id);
    }, this);
    this.markMutated();
    this.render();
    this.announce("The lesson layout was reset.");
    return true;
  };

  Workspace.prototype.setWidgetAvailability = function (identifiers) {
    const next = new Set((identifiers || []).map(String));
    next.add("coding");
    if (this.registry.has("robot_view")) next.add("robot_view");
    if (this.registry.has("lesson_output")) next.add("lesson_output");
    next.add("tab_group");
    this.available = next;
    const removed = this.records.filter(function (record) { return !next.has(record.identifier); });
    removed.forEach(function (record) { this.lastRecords.set(record.identifier, copyRecord(record)); }, this);
    this.records = this.records.filter(function (record) { return next.has(record.identifier); });
    this.render();
    this.save();
    return true;
  };

  Workspace.prototype.addWidget = function (identifier, tabGroup) {
    const definition = this.registry.get(identifier);
    if (!definition || !this.available.has(identifier)) return false;
    if (this.records.some(function (record) { return record.identifier === identifier; })) return false;
    const preferred = copyRecord(
      this.lastRecords.get(identifier) || Object.assign({identifier: identifier}, definition.position)
    );
    preferred.tab_group = tabGroup || preferred.tab_group || null;
    if (preferred.tab_group) {
      const separator = preferred.tab_group.indexOf("/");
      const groupIdentifier = preferred.tab_group.slice(0, separator);
      const tabIdentifier = preferred.tab_group.slice(separator + 1);
      const groupPresent = this.records.some(function (record) {
        return record.identifier === groupIdentifier && record.tab_group === null;
      });
      if (!groupPresent || !this.tabExists(groupIdentifier, tabIdentifier)) preferred.tab_group = null;
    }
    let candidate = preferred;
    if (candidate.position_x + candidate.width > COLUMNS
        || candidate.position_y + candidate.height > this.maxRows) {
      candidate.position_x = clamp(candidate.position_x, 0, COLUMNS - candidate.width);
      candidate.position_y = clamp(candidate.position_y, 0, this.maxRows - candidate.height);
    }
    this.records.push(copyRecord(candidate));
    this.bringToFront(identifier);
    this.markMutated();
    this.render();
    this.announce(definition.title + " restored.");
    return true;
  };

  Workspace.prototype.removeWidget = function (identifier) {
    const index = this.records.findIndex(function (record) { return record.identifier === identifier; });
    if (index < 0) return false;
    const definition = this.registry.get(identifier);
    const removedIdentifiers = new Set([identifier]);
    if (definition && definition.kind === "tabs") {
      this.records.forEach(function (record) {
        if (record.tab_group && record.tab_group.indexOf(identifier + "/") === 0) {
          removedIdentifiers.add(record.identifier);
        }
      });
    }
    this.records.filter(function (record) {
      return removedIdentifiers.has(record.identifier);
    }).forEach(function (record) {
      this.lastRecords.set(record.identifier, copyRecord(record));
      const childDefinition = this.registry.get(record.identifier);
      if (childDefinition && childDefinition.node) this.vault.appendChild(childDefinition.node);
    }, this);
    this.records = this.records.filter(function (record) {
      return !removedIdentifiers.has(record.identifier);
    });
    removedIdentifiers.forEach(function (removedIdentifier) {
      this.updateLifecycle(removedIdentifier, false, "removed");
    }, this);
    this.markMutated();
    this.render();
    this.announce((definition ? definition.title : identifier) + " removed. Use Add panel to restore it.");
    return true;
  };

  Workspace.prototype.moveToTab = function (identifier) {
    const record = this.records.find(function (item) { return item.identifier === identifier; });
    if (!record) return false;
    if (record.tab_group) {
      const groupIdentifier = record.tab_group.split("/")[0];
      const groupRecord = this.records.find(function (item) { return item.identifier === groupIdentifier; });
      const bounds = this.registry.get(identifier).bounds;
      record.position_x = groupRecord ? groupRecord.position_x : 0;
      record.position_y = groupRecord ? groupRecord.position_y : 0;
      record.width = clamp(groupRecord ? groupRecord.width : record.width, bounds.minWidth, bounds.maxWidth);
      record.height = clamp(groupRecord ? groupRecord.height : record.height, bounds.minHeight, bounds.maxHeight);
      record.position_x = clamp(record.position_x, 0, COLUMNS - record.width);
      record.position_y = clamp(record.position_y, 0, this.maxRows - record.height);
      record.tab_group = null;
      this.announce("Panel moved to the main workspace.");
    } else {
      const groupRecord = this.records.find(function (item) {
        const definition = this.registry.get(item.identifier);
        return definition && definition.kind === "tabs" && item.tab_group === null;
      }, this);
      if (!groupRecord) {
        this.announce("Add a tabbed group before moving a panel into it.");
        return false;
      }
      const tabId = this.activeTabs.get(groupRecord.identifier)
        || (this.tabState.get(groupRecord.identifier) || [])[0]?.id;
      if (!tabId) return false;
      const context = groupRecord.identifier + "/" + tabId;
      const bounds = this.registry.get(identifier).bounds;
      record.width = clamp(COLUMNS, bounds.minWidth, bounds.maxWidth);
      record.height = clamp(groupRecord.height - 3, bounds.minHeight, bounds.maxHeight);
      record.position_x = 0;
      record.position_y = 0;
      record.tab_group = context;
      this.announce("Panel moved into " + tabId.replace(/-/g, " ") + ".");
    }
    this.bringToFront(identifier);
    this.markMutated();
    this.render();
    return true;
  };

  Workspace.prototype.registerWidgetLifecycle = function (identifier, hooks) {
    const key = String(identifier);
    this.lifecycle.set(key, hooks || {});
    this.lifecycleState.delete(key);
    this.lifecycleMounted.delete(key);
    this.updateLifecycle(key, this.isWidgetActive(key), "registered");
    return function () {
      this.lifecycle.delete(key);
      this.lifecycleState.delete(key);
      this.lifecycleMounted.delete(key);
    }.bind(this);
  };

  Workspace.prototype.updateLifecycle = function (identifier, active, reason) {
    const previous = this.lifecycleState.get(identifier);
    const hooks = this.lifecycle.get(identifier) || {};
    const hasHooks = this.lifecycle.has(identifier);
    const present = this.records.some(function (record) { return record.identifier === identifier; });
    let mounted = this.lifecycleMounted.has(identifier);
    let changed = previous !== active;
    try {
      if (hasHooks && present && !mounted) {
        if (typeof hooks.mount === "function") hooks.mount();
        this.lifecycleMounted.add(identifier);
        mounted = true;
        changed = true;
      }
      if (hasHooks && previous !== active) {
        if (active && mounted && typeof hooks.resume === "function") hooks.resume();
        if (!active && mounted && typeof hooks.pause === "function") hooks.pause();
      }
      if (hasHooks && !present && mounted) {
        if (previous === active && active && typeof hooks.pause === "function") hooks.pause();
        if (typeof hooks.unmount === "function") hooks.unmount();
        this.lifecycleMounted.delete(identifier);
        mounted = false;
        changed = true;
      }
    } catch (error) {
      console.error("[Simulator widget lifecycle]", error);
    }
    this.lifecycleState.set(identifier, active);
    if (changed) emitVisibility(this, identifier, active, reason);
  };

  Workspace.prototype.isWidgetActive = function (identifier) {
    if (this.document.hidden) return false;
    const record = this.records.find(function (item) { return item.identifier === identifier; });
    if (!record) return false;
    if (!record.tab_group) return true;
    const separator = record.tab_group.indexOf("/");
    const groupIdentifier = record.tab_group.slice(0, separator);
    const tabIdentifier = record.tab_group.slice(separator + 1);
    const groupPresent = this.records.some(function (candidate) {
      return candidate.identifier === groupIdentifier && candidate.tab_group === null;
    });
    if (!groupPresent) return false;
    return this.activeTabs.get(groupIdentifier) === tabIdentifier;
  };

  Workspace.prototype.announce = function (message) {
    this.liveRegion.textContent = "";
    const self = this;
    global.setTimeout(function () { self.liveRegion.textContent = String(message); }, 10);
  };

  Workspace.prototype.applyStackOrder = function () {
    this.stackOrder = this.stackOrder.filter(function (identifier, index, order) {
      return order.indexOf(identifier) === index
        && this.records.some(function (record) { return record.identifier === identifier; });
    }, this);
    this.records.forEach(function (record) {
      if (!this.stackOrder.includes(record.identifier)) {
        this.stackOrder.push(record.identifier);
      }
    }, this);
    this.stackOrder.forEach(function (identifier, index) {
      const frame = this.frames.get(identifier);
      if (frame) frame.style.zIndex = String(index + 2);
    }, this);
  };

  Workspace.prototype.applyNarrowOrder = function () {
    this.narrowOrder = this.narrowOrder.filter(function (identifier, index, order) {
      return order.indexOf(identifier) === index
        && this.records.some(function (record) { return record.identifier === identifier; });
    }, this);
    this.records.forEach(function (record) {
      if (!this.narrowOrder.includes(record.identifier)) this.narrowOrder.push(record.identifier);
    }, this);
    this.narrowOrder.forEach(function (identifier, index) {
      const frame = this.frames.get(identifier);
      if (frame) frame.style.order = String(index);
    }, this);
  };

  Workspace.prototype.bringToFront = function (identifier) {
    const index = this.stackOrder.indexOf(identifier);
    if (index === this.stackOrder.length - 1) return;
    if (index >= 0) this.stackOrder.splice(index, 1);
    this.stackOrder.push(identifier);
    this.applyStackOrder();
    this.applyNarrowOrder();
    this.save();
  };

  Workspace.prototype.applyRecordStyle = function (frame, record) {
    frame.style.gridColumn = (record.position_x + 1) + " / span " + record.width;
    frame.style.gridRow = (record.position_y + 1) + " / span " + record.height;
    frame.dataset.positionX = String(record.position_x);
    frame.dataset.positionY = String(record.position_y);
    frame.dataset.width = String(record.width);
    frame.dataset.height = String(record.height);
    frame.style.setProperty("--sim-widget-mobile-height", (record.height * (ROW_HEIGHT + GAP)) + "px");
  };

  Workspace.prototype.refreshGridMetrics = function () {
    if (!this.root || !this.root.querySelectorAll) return;
    const grids = this.root.querySelectorAll(".sim-dashboard-grid");
    Array.prototype.forEach.call(grids, function (grid) {
      const rect = grid.getBoundingClientRect();
      const width = rect && rect.width || grid.clientWidth || 0;
      if (width <= 0) return;
      // Track width + gap simplifies to (grid width + one gap) / 24.
      // Keeping the measured value in CSS makes the guide dots land on the
      // exact same intersections as the layout engine at every viewport.
      const pitch = (width + GAP) / COLUMNS;
      grid.style.setProperty("--sim-grid-pitch-x", pitch.toFixed(3) + "px");
    });
  };

  Workspace.prototype.installGamepadFitter = function (definition) {
    if (!definition || definition.identifier !== "gamepad" || this.gamepadFitters.has(definition.node)) return;
    const body = definition.node.querySelector(
      "#sim-gamepad-body, #gamepad-card-body, #gamepad-body, .gamepad-card-body, .gamepad-panel"
    ) || definition.node;
    const controller = definition.node.querySelector(
      "#sim-controller-wrap, #controller-wrap, .sim-controller-wrap, .controller-wrap"
    );
    if (!body || !controller) return;

    let pending = null;
    const fit = function () {
      pending = null;
      if (!body.isConnected || !controller.isConnected) return;
      const computed = typeof global.getComputedStyle === "function" ? global.getComputedStyle(body) : null;
      const paddingX = computed
        ? (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0)
        : 0;
      const paddingY = computed
        ? (parseFloat(computed.paddingTop) || 0) + (parseFloat(computed.paddingBottom) || 0)
        : 0;
      let reservedHeight = 0;
      Array.prototype.forEach.call(body.children || [], function (child) {
        if (child === controller) return;
        const childStyle = typeof global.getComputedStyle === "function" ? global.getComputedStyle(child) : null;
        if (childStyle && (childStyle.position === "absolute" || childStyle.display === "none")) return;
        const childRect = child.getBoundingClientRect();
        reservedHeight += childRect.height || child.offsetHeight || 0;
      });
      if (reservedHeight > 0 && computed) reservedHeight += parseFloat(computed.gap) || 0;
      const availableWidth = Math.max(0, body.clientWidth - paddingX);
      const availableHeight = Math.max(0, body.clientHeight - paddingY - reservedHeight);
      if (availableWidth <= 0 || availableHeight <= 0) return;
      const aspect = 768 / 512;
      const width = Math.max(1, Math.min(availableWidth, availableHeight * aspect));
      const height = width / aspect;
      controller.style.setProperty("--sim-controller-fit-width", width.toFixed(2) + "px");
      controller.style.setProperty("--sim-controller-fit-height", height.toFixed(2) + "px");
    };
    const queue = function () {
      if (pending != null) return;
      pending = scheduleFrame(fit);
    };
    const observer = typeof global.ResizeObserver === "function"
      ? new global.ResizeObserver(queue)
      : null;
    const mutationObserver = typeof global.MutationObserver === "function"
      ? new global.MutationObserver(queue)
      : null;
    if (observer) observer.observe(body);
    if (mutationObserver) mutationObserver.observe(body, {childList: true});
    definition.node.addEventListener("telemark:widget-visibility", queue);
    this.gamepadFitters.set(definition.node, {
      fit: fit,
      queue: queue,
      destroy: function () {
        cancelFrame(pending);
        if (observer) observer.disconnect();
        if (mutationObserver) mutationObserver.disconnect();
        definition.node.removeEventListener("telemark:widget-visibility", queue);
      },
    });
    queue();
  };

  Workspace.prototype.refreshAdaptiveContent = function () {
    this.registry.forEach(function (definition) {
      this.installGamepadFitter(definition);
    }, this);
    this.gamepadFitters.forEach(function (fitter) { fitter.queue(); });
  };

  Workspace.prototype.scheduleMeasurements = function () {
    if (this.measureFrame != null || this.destroyed) return;
    const self = this;
    this.measureFrame = scheduleFrame(function () {
      self.measureFrame = null;
      self.refreshGridMetrics();
      self.refreshAdaptiveContent();
    });
  };

  Workspace.prototype.scheduleContentResize = function () {
    if (this.contentResizeFrame != null || this.destroyed) return;
    const self = this;
    this.contentResizeFrame = scheduleFrame(function () {
      self.contentResizeFrame = null;
      self.refreshGridMetrics();
      self.refreshAdaptiveContent();
      dispatchResize();
    });
  };

  Workspace.prototype.handleViewportChange = function (fullscreen) {
    if (typeof fullscreen === "boolean") {
      this.document.documentElement.setAttribute("data-sim-host-fullscreen", String(fullscreen));
    }
    this.scheduleContentResize();
    global.clearTimeout(this.fullscreenSettleTimer);
    const self = this;
    this.fullscreenSettleTimer = global.setTimeout(function () {
      self.refreshGridMetrics();
      self.refreshAdaptiveContent();
      dispatchResize();
    }, 120);
  };

  Workspace.prototype.createFrame = function (definition, record) {
    const doc = this.document;
    const frame = doc.createElement("section");
    frame.className = "sim-widget sim-widget-" + definition.identifier.replace(/[^a-z0-9_-]+/gi, "-");
    frame.dataset.widgetId = definition.identifier;
    frame.dataset.widgetCategory = definition.category;
    const self = this;
    ["pointerdown", "focusin", "click"].forEach(function (eventName) {
      frame.addEventListener(eventName, function () { self.bringToFront(definition.identifier); }, true);
    });

    const header = doc.createElement("header");
    header.className = "sim-widget-header";
    header.tabIndex = 0;
    header.setAttribute("aria-label", "Move " + definition.title);
    header.innerHTML = '<span class="sim-widget-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>'
      + '<span class="sim-widget-heading"><strong class="sim-widget-title"></strong></span>';
    header.querySelector(".sim-widget-title").textContent = definition.title;

    const narrowMoves = doc.createElement("span");
    narrowMoves.className = "sim-widget-narrow-moves";
    const upButton = makeButton(doc, "sim-widget-icon-button", "Move " + definition.title + " earlier", "m7 14 5-5 5 5");
    const downButton = makeButton(doc, "sim-widget-icon-button", "Move " + definition.title + " later", "m7 10 5 5 5-5");
    narrowMoves.appendChild(upButton);
    narrowMoves.appendChild(downButton);
    header.appendChild(narrowMoves);

    if (definition.kind !== "tabs") {
      const dockLabel = record.tab_group ? "Move panel to main workspace" : "Move panel into active tab";
      const dockButton = makeButton(doc, "sim-widget-icon-button sim-widget-dock", dockLabel, "M4 5h16v14H4zM8 9h8M8 13h5");
      header.appendChild(dockButton);
      dockButton.addEventListener("click", function (event) {
        event.stopPropagation();
        this.moveToTab(definition.identifier);
      }.bind(this));
    }

    const removeButton = makeButton(doc, "sim-widget-icon-button", "Remove " + definition.title, "M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12M10 11v5m4-5v5");
    header.appendChild(removeButton);
    frame.appendChild(header);

    const content = doc.createElement("div");
    content.className = "sim-widget-content";
    content.appendChild(definition.node);
    frame.appendChild(content);

    ["right", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"].forEach(function (edge) {
      const handle = doc.createElement("div");
      handle.className = "sim-widget-resize sim-widget-resize-" + edge;
      handle.tabIndex = 0;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-label", "Resize " + definition.title + " from the " + edge.replace(/-/g, " ")
        + (edge.includes("-") ? " corner" : " edge"));
      handle.dataset.resizeEdge = edge;
      frame.appendChild(handle);
      this.bindResize(handle, definition.identifier, edge);
    }, this);

    removeButton.addEventListener("click", function (event) {
      event.stopPropagation();
      self.removeWidget(definition.identifier);
    });
    upButton.addEventListener("click", function (event) {
      event.stopPropagation();
      self.reorderNarrow(definition.identifier, -1);
    });
    downButton.addEventListener("click", function (event) {
      event.stopPropagation();
      self.reorderNarrow(definition.identifier, 1);
    });
    this.bindMove(header, definition.identifier);
    this.applyRecordStyle(frame, record);
    this.frames.set(definition.identifier, frame);
    return frame;
  };

  Workspace.prototype.renderTabs = function (definition, groupRecord) {
    const node = definition.node;
    node.innerHTML = "";
    const tabs = this.tabState.get(definition.identifier) || [];
    let activeTab = this.activeTabs.get(definition.identifier);
    if (!tabs.some(function (tab) { return tab.id === activeTab; }) && tabs[0]) {
      activeTab = tabs[0].id;
      this.activeTabs.set(definition.identifier, activeTab);
    }
    const tabList = this.document.createElement("div");
    tabList.className = "sim-tab-list";
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", definition.title + " tabs");
    const paneHost = this.document.createElement("div");
    paneHost.className = "sim-tab-panes";
    const self = this;

    tabs.forEach(function (tab) {
      const button = self.document.createElement("button");
      button.type = "button";
      button.className = "sim-tab-button";
      button.id = "sim-tab-button-" + definition.identifier + "-" + tab.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(tab.id === activeTab));
      button.setAttribute("aria-controls", "sim-tab-pane-" + definition.identifier + "-" + tab.id);
      button.tabIndex = tab.id === activeTab ? 0 : -1;
      button.dataset.tabGroupIdentifier = definition.identifier;
      button.dataset.tabIdentifier = tab.id;
      button.textContent = tab.label;
      button.addEventListener("click", function () { self.activateTab(definition.identifier, tab.id); });
      tabList.appendChild(button);

      const pane = self.document.createElement("section");
      pane.className = "sim-tab-pane";
      pane.id = "sim-tab-pane-" + definition.identifier + "-" + tab.id;
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("aria-labelledby", button.id);
      const active = tab.id === activeTab;
      pane.setAttribute("aria-hidden", String(!active));
      pane.inert = !active;
      pane.hidden = !active;
      const nestedGrid = self.document.createElement("div");
      nestedGrid.className = "sim-tab-grid sim-dashboard-grid";
      nestedGrid.dataset.tabGroup = definition.identifier + "/" + tab.id;
      if (!self.records.some(function (record) {
        return record.tab_group === nestedGrid.dataset.tabGroup;
      })) {
        const empty = self.document.createElement("p");
        empty.className = "sim-tab-empty";
        empty.textContent = "This tab is empty. Use a panel’s move button to place it here.";
        nestedGrid.appendChild(empty);
      }
      pane.appendChild(nestedGrid);
      paneHost.appendChild(pane);
    });

    tabList.addEventListener("keydown", function (event) {
      const current = event.target.closest && event.target.closest(".sim-tab-button");
      if (!current || !tabList.contains(current)) return;
      const index = tabs.findIndex(function (tab) { return tab.id === current.dataset.tabIdentifier; });
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      if (next >= 0 && tabs[next]) self.activateTab(definition.identifier, tabs[next].id);
      event.preventDefault();
    });

    const addTab = makeButton(this.document, "sim-tab-add", "Add tab", "M12 5v14M5 12h14");
    tabList.appendChild(addTab);
    addTab.addEventListener("click", function () { self.addTab(definition.identifier); });
    node.appendChild(tabList);
    node.appendChild(paneHost);
    return groupRecord;
  };

  Workspace.prototype.addTab = function (groupIdentifier) {
    const tabs = this.tabState.get(groupIdentifier) || [];
    const nextNumber = tabs.length + 1;
    const id = "tab-" + nextNumber;
    tabs.push({id: id, label: "Tab " + nextNumber});
    this.tabState.set(groupIdentifier, tabs);
    this.activeTabs.set(groupIdentifier, id);
    this.markMutated();
    this.render();
    this.focusTab(groupIdentifier, id);
    this.announce("Tab " + nextNumber + " added.");
  };

  Workspace.prototype.activateTab = function (groupIdentifier, tabIdentifier) {
    if (!this.tabExists(groupIdentifier, tabIdentifier)) return false;
    this.activeTabs.set(groupIdentifier, tabIdentifier);
    const definition = this.registry.get(groupIdentifier);
    if (definition && definition.node) {
      definition.node.querySelectorAll(".sim-tab-button").forEach(function (button) {
        const active = button.dataset.tabIdentifier === tabIdentifier;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      definition.node.querySelectorAll(".sim-tab-pane").forEach(function (pane) {
        const active = pane.id === "sim-tab-pane-" + groupIdentifier + "-" + tabIdentifier;
        pane.hidden = !active;
        pane.inert = !active;
        pane.setAttribute("aria-hidden", String(!active));
      });
    }
    this.records.forEach(function (record) {
      if (record.tab_group && record.tab_group.indexOf(groupIdentifier + "/") === 0) {
        this.updateLifecycle(record.identifier, this.isWidgetActive(record.identifier), "tab-selected");
      }
    }, this);
    this.save();
    this.scheduleContentResize();
    this.focusTab(groupIdentifier, tabIdentifier);
    this.announce(tabIdentifier.replace(/-/g, " ") + " selected.");
    return true;
  };

  Workspace.prototype.focusTab = function (groupIdentifier, tabIdentifier) {
    const self = this;
    scheduleFrame(function () {
      const buttons = self.root.querySelectorAll(".sim-tab-button");
      for (let index = 0; index < buttons.length; index += 1) {
        const button = buttons[index];
        if (button.dataset.tabGroupIdentifier === groupIdentifier
            && button.dataset.tabIdentifier === tabIdentifier) {
          button.focus();
          return;
        }
      }
    });
  };

  Workspace.prototype.render = function () {
    const previousFrames = Array.from(this.frames.values());
    previousFrames.forEach(function (frame) { frame.remove(); });
    this.frames.clear();
    this.grid.querySelectorAll(".sim-widget-drop-preview").forEach(function (node) { node.remove(); });

    const roots = this.records.filter(function (record) { return !record.tab_group; });
    roots.sort(function (a, b) { return a.position_y - b.position_y || a.position_x - b.position_x; });

    roots.forEach(function (record) {
      const definition = this.registry.get(record.identifier);
      if (!definition) return;
      const frame = this.createFrame(definition, record);
      this.grid.appendChild(frame);
      if (definition.kind === "tabs") this.renderTabs(definition, record);
    }, this);

    this.records.filter(function (record) { return !!record.tab_group; })
      .sort(function (a, b) { return a.position_y - b.position_y || a.position_x - b.position_x; })
      .forEach(function (record) {
      const definition = this.registry.get(record.identifier);
      if (!definition) return;
      const targetGrid = this.grid.querySelector('.sim-tab-grid[data-tab-group="' + record.tab_group.replace(/"/g, "") + '"]');
      if (!targetGrid) {
        this.vault.appendChild(definition.node);
        return;
      }
      const frame = this.createFrame(definition, record);
      targetGrid.appendChild(frame);
      }, this);

    this.registry.forEach(function (definition, identifier) {
      const present = this.records.some(function (record) { return record.identifier === identifier; });
      if (!present && definition.node.parentNode !== this.vault) this.vault.appendChild(definition.node);
      this.updateLifecycle(identifier, this.isWidgetActive(identifier), present ? "rendered" : "removed");
    }, this);

    this.applyStackOrder();
    this.applyNarrowOrder();

    this.emptyState.hidden = roots.length !== 0;
    this.updatePalette();
    this.scheduleContentResize();
  };

  Workspace.prototype.updatePalette = function () {
    if (!this.palette) return;
    this.palette.innerHTML = "";
    const title = this.document.createElement("div");
    title.className = "sim-widget-palette-title";
    title.textContent = "Available in this lesson";
    this.palette.appendChild(title);
    let optionCount = 0;
    const self = this;
    this.registry.forEach(function (definition, identifier) {
      const visible = self.records.some(function (record) { return record.identifier === identifier; });
      if (visible || !self.available.has(identifier)) return;
      optionCount += 1;
      const button = self.document.createElement("button");
      button.type = "button";
      button.className = "sim-widget-palette-option "
        + (definition.category === "software" ? "sim-widget-palette-software" : "sim-widget-palette-hardware");
      button.setAttribute("role", "menuitem");
      const label = self.document.createElement("strong");
      label.textContent = definition.title;
      const category = self.document.createElement("span");
      category.textContent = definition.kind === "tabs" ? "Container" : definition.category === "software" ? "Software" : "Hardware";
      button.appendChild(label);
      button.appendChild(category);
      button.addEventListener("click", function () {
        self.addWidget(identifier, null);
        self.closePalette();
      });
      self.palette.appendChild(button);
    });
    if (!optionCount) {
      const empty = this.document.createElement("p");
      empty.className = "sim-widget-palette-empty";
      empty.textContent = "All lesson panels are open.";
      this.palette.appendChild(empty);
    }
  };

  Workspace.prototype.togglePalette = function () {
    if (this.palette.hidden) this.openPalette();
    else this.closePalette();
  };

  Workspace.prototype.openPalette = function () {
    this.updatePalette();
    this.palette.hidden = false;
    this.addButton.setAttribute("aria-expanded", "true");
    const first = this.palette.querySelector("button");
    if (first) first.focus();
  };

  Workspace.prototype.closePalette = function () {
    if (this.palette.hidden) return;
    this.palette.hidden = true;
    this.addButton.setAttribute("aria-expanded", "false");
    this.addButton.focus();
  };

  Workspace.prototype.contextGridFor = function (record) {
    if (!record.tab_group) return this.grid;
    return this.grid.querySelector('.sim-tab-grid[data-tab-group="' + record.tab_group.replace(/"/g, "") + '"]');
  };

  Workspace.prototype.previewCandidate = function (grid, candidate, valid) {
    if (!grid) return null;
    let preview = grid.querySelector(":scope > .sim-widget-drop-preview");
    if (!preview) {
      preview = this.document.createElement("div");
      preview.className = "sim-widget-drop-preview";
      preview.setAttribute("aria-hidden", "true");
      grid.appendChild(preview);
    }
    preview.classList.toggle("invalid", !valid);
    preview.style.gridColumn = (candidate.position_x + 1) + " / span " + candidate.width;
    preview.style.gridRow = (candidate.position_y + 1) + " / span " + candidate.height;
    return preview;
  };

  Workspace.prototype.clearPreview = function (grid) {
    if (!grid) return;
    const preview = grid.querySelector(":scope > .sim-widget-drop-preview");
    if (preview) preview.remove();
  };

  Workspace.prototype.validCandidate = function (candidate, identifier) {
    return candidate.position_x >= 0
      && candidate.position_y >= 0
      && candidate.position_x + candidate.width <= COLUMNS
      && candidate.position_y + candidate.height <= this.maxRows;
  };

  Workspace.prototype.bindMove = function (header, identifier) {
    const self = this;
    header.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.target.closest("button")) return;
      if (global.matchMedia && global.matchMedia("(max-width: 640px)").matches) return;
      const record = self.records.find(function (item) { return item.identifier === identifier; });
      const frame = self.frames.get(identifier);
      const grid = record && self.contextGridFor(record);
      if (!record || !frame || !grid) return;
      const frameRect = frame.getBoundingClientRect();
      self.dragState = {
        kind: "move",
        identifier: identifier,
        record: copyRecord(record),
        candidate: copyRecord(record),
        frame: frame,
        grid: grid,
        gridRect: grid.getBoundingClientRect(),
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        offset: {x: event.clientX - frameRect.left, y: event.clientY - frameRect.top},
        valid: true,
        liveCandidate: copyRecord(record),
      };
      frame.classList.add("sim-widget-moving");
      self.scroll.classList.add("sim-workspace-dragging");
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", function (event) { self.onPointerMove(event); });
    header.addEventListener("pointerup", function (event) { self.finishPointer(event, true); });
    header.addEventListener("pointercancel", function (event) { self.finishPointer(event, false); });
    header.addEventListener("keydown", function (event) { self.onMoveKey(event, identifier); });
  };

  Workspace.prototype.bindResize = function (handle, identifier, edge) {
    const self = this;
    handle.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      const record = self.records.find(function (item) { return item.identifier === identifier; });
      const frame = self.frames.get(identifier);
      const grid = record && self.contextGridFor(record);
      if (!record || !frame || !grid) return;
      const gridRect = grid.getBoundingClientRect();
      const cellWidth = (gridRect.width - GAP * (COLUMNS - 1)) / COLUMNS;
      self.dragState = {
        kind: "resize",
        edge: edge,
        identifier: identifier,
        record: copyRecord(record),
        candidate: copyRecord(record),
        frame: frame,
        grid: grid,
        gridRect: gridRect,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        pitchX: cellWidth + GAP,
        pitchY: ROW_HEIGHT + GAP,
        narrow: Boolean(global.matchMedia && global.matchMedia("(max-width: 640px)").matches),
        valid: true,
        liveCandidate: copyRecord(record),
      };
      frame.classList.add("sim-widget-moving");
      self.scroll.classList.add("sim-workspace-dragging");
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointermove", function (event) { self.onPointerMove(event); });
    handle.addEventListener("pointerup", function (event) { self.finishPointer(event, true); });
    handle.addEventListener("pointercancel", function (event) { self.finishPointer(event, false); });
    handle.addEventListener("keydown", function (event) { self.onResizeKey(event, identifier, edge); });
  };

  Workspace.prototype.onPointerMove = function (event) {
    const state = this.dragState;
    if (!state || state.kind !== "move" && state.kind !== "resize") return;
    if (state.pointerId !== undefined && event.pointerId !== undefined && state.pointerId !== event.pointerId) return;
    const definition = this.registry.get(state.identifier);
      let candidate = copyRecord(state.record);
    if (state.kind === "move") {
      const latestGridRect = state.grid.getBoundingClientRect();
      if (latestGridRect.width > 0) state.gridRect = latestGridRect;
      const cell = pointToCell(state.gridRect, event.clientX, event.clientY, state.offset, this.maxRows);
      candidate.position_x = clamp(cell.x, 0, COLUMNS - candidate.width);
      candidate.position_y = clamp(cell.y, 0, this.maxRows - candidate.height);
    } else {
      const latestGridRect = state.grid.getBoundingClientRect();
      if (latestGridRect.width > 0 && Math.abs(latestGridRect.width - state.gridRect.width) > 0.5) {
        state.gridRect = latestGridRect;
        state.pitchX = (latestGridRect.width + GAP) / COLUMNS;
      }
      const deltaColumns = Math.round((event.clientX - state.startX) / state.pitchX);
      const deltaRows = Math.round((event.clientY - state.startY) / state.pitchY);
      candidate = state.narrow
        ? resizeNarrowRecord(state.record, definition.bounds, state.edge, deltaRows)
        : resizeRecord(state.record, definition.bounds, state.edge,
          deltaColumns, deltaRows, this.maxRows);
    }
    state.candidate = candidate;
    state.valid = this.validCandidate(candidate, state.identifier);
    state.frame.classList.toggle("sim-widget-invalid", !state.valid);
    if (state.valid) {
      const changed = !state.liveCandidate
        || state.liveCandidate.position_x !== candidate.position_x
        || state.liveCandidate.position_y !== candidate.position_y
        || state.liveCandidate.width !== candidate.width
        || state.liveCandidate.height !== candidate.height;
      if (changed) {
        state.liveCandidate = copyRecord(candidate);
        this.applyRecordStyle(state.frame, candidate);
        this.scheduleContentResize();
      }
      this.clearPreview(state.grid);
    } else {
      this.previewCandidate(state.grid, candidate, false);
    }
    if (event && event.preventDefault) event.preventDefault();
  };

  Workspace.prototype.finishPointer = function (event, commit) {
    const state = this.dragState;
    if (!state || state.kind !== "move" && state.kind !== "resize") return;
    if (state.pointerId !== undefined && event && event.pointerId !== undefined && state.pointerId !== event.pointerId) return;
    state.frame.style.transform = "";
    state.frame.classList.remove("sim-widget-moving", "sim-widget-invalid");
    this.scroll.classList.remove("sim-workspace-dragging");
    this.clearPreview(state.grid);
    this.dragState = null;
    if (commit && state.valid) {
      const index = this.records.findIndex(function (item) { return item.identifier === state.identifier; });
      if (index >= 0) this.records[index] = copyRecord(state.candidate);
      this.markMutated();
      this.render();
      this.announce((this.registry.get(state.identifier) || {}).title + " placed at column "
        + state.candidate.position_x + ", row " + state.candidate.position_y + ".");
    } else {
      this.applyRecordStyle(state.frame, state.record);
      if (commit && !state.valid) this.announce("That position is outside the workspace. The panel returned to its previous position.");
    }
    if (event) event.preventDefault();
  };

  Workspace.prototype.onMoveKey = function (event, identifier) {
    if (event.target !== event.currentTarget) return;
    const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (!this.dragState && (event.key === " " || event.key === "Enter")) {
      const record = this.records.find(function (item) { return item.identifier === identifier; });
      if (!record) return;
      this.dragState = {kind: "keyboard-move", identifier: identifier, record: copyRecord(record), candidate: copyRecord(record), valid: true};
      this.announce("Move mode. Use arrow keys, Enter to place, or Escape to cancel.");
      event.preventDefault();
      return;
    }
    const state = this.dragState;
    if (!state || state.kind !== "keyboard-move" || state.identifier !== identifier) return;
    if (event.key === "Escape") {
      this.dragState = null;
      this.render();
      this.announce("Move cancelled.");
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      if (state.valid) {
        const index = this.records.findIndex(function (item) { return item.identifier === identifier; });
        this.records[index] = copyRecord(state.candidate);
        this.dragState = null;
        this.markMutated();
        this.render();
        this.announce("Panel placed.");
      } else {
        this.announce("That position is outside the workspace.");
      }
      event.preventDefault();
      return;
    }
    if (!arrows[event.key]) return;
    const delta = arrows[event.key];
    const candidate = copyRecord(state.candidate);
    candidate.position_x = clamp(candidate.position_x + delta[0], 0, COLUMNS - candidate.width);
    candidate.position_y = clamp(candidate.position_y + delta[1], 0, this.maxRows - candidate.height);
    state.candidate = candidate;
    state.valid = this.validCandidate(candidate, identifier);
    const frame = this.frames.get(identifier);
    if (frame) {
      this.applyRecordStyle(frame, candidate);
      frame.classList.toggle("sim-widget-invalid", !state.valid);
    }
    this.announce("Column " + candidate.position_x + ", row " + candidate.position_y + ".");
    event.preventDefault();
  };

  Workspace.prototype.onResizeKey = function (event, identifier, edge) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const record = this.records.find(function (item) { return item.identifier === identifier; });
    const definition = this.registry.get(identifier);
    if (!record || !definition) return;
    const narrow = Boolean(global.matchMedia && global.matchMedia("(max-width: 640px)").matches);
    if (narrow && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
    const horizontal = edge === "right" || edge.includes("left") || edge.includes("right");
    const vertical = edge === "bottom" || edge.includes("top") || edge.includes("bottom");
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !horizontal) return;
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !vertical) return;
    const deltaColumns = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const deltaRows = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    const candidate = narrow
      ? resizeNarrowRecord(record, definition.bounds, edge, deltaRows)
      : resizeRecord(record, definition.bounds, edge, deltaColumns, deltaRows, this.maxRows);
    const index = this.records.findIndex(function (item) { return item.identifier === identifier; });
    this.records[index] = candidate;
    this.markMutated();
    this.render();
    const nextHandle = this.frames.get(identifier) && this.frames.get(identifier).querySelector('[data-resize-edge="' + edge + '"]');
    if (nextHandle) nextHandle.focus();
    this.announce("Panel size " + candidate.width + " columns by " + candidate.height + " rows.");
    event.preventDefault();
  };

  Workspace.prototype.reorderNarrow = function (identifier, direction) {
    const record = this.records.find(function (item) { return item.identifier === identifier; });
    if (!record) return false;
    this.applyNarrowOrder();
    const contextOrder = this.narrowOrder.filter(function (itemIdentifier) {
      const item = this.records.find(function (candidate) { return candidate.identifier === itemIdentifier; });
      return item && sameContext(item, record);
    }, this);
    const index = contextOrder.indexOf(identifier);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= contextOrder.length) return false;
    const swapIdentifier = contextOrder[targetIndex];
    const first = this.narrowOrder.indexOf(identifier);
    const second = this.narrowOrder.indexOf(swapIdentifier);
    this.narrowOrder[first] = swapIdentifier;
    this.narrowOrder[second] = identifier;
    this.markMutated();
    this.applyNarrowOrder();
    this.announce("Panel moved " + (direction < 0 ? "earlier" : "later") + ".");
    return true;
  };

  Workspace.prototype.bindGlobalEvents = function () {
    const self = this;
    // Pointer capture can be lost when a nested lesson surface redraws during
    // a drag. Keep the active gesture alive anywhere in the document.
    this.documentPointerMoveHandler = function (event) { self.onPointerMove(event); };
    this.documentPointerUpHandler = function (event) { self.finishPointer(event, true); };
    this.documentPointerCancelHandler = function (event) { self.finishPointer(event, false); };
    this.document.addEventListener("pointermove", this.documentPointerMoveHandler);
    this.document.addEventListener("pointerup", this.documentPointerUpHandler);
    this.document.addEventListener("pointercancel", this.documentPointerCancelHandler);
    this.outsidePointerHandler = function (event) {
      if (self.palette.hidden) return;
      if (self.palette.contains(event.target) || self.addButton.contains(event.target)) return;
      self.closePalette();
    };
    this.document.addEventListener("pointerdown", this.outsidePointerHandler);
    this.keydownHandler = function (event) {
      if (event.key === "Escape" && !self.palette.hidden) self.closePalette();
    };
    this.document.addEventListener("keydown", this.keydownHandler);
    this.visibilityHandler = function () {
      self.registry.forEach(function (_definition, identifier) {
        self.updateLifecycle(identifier, self.isWidgetActive(identifier), self.document.hidden ? "document-hidden" : "document-visible");
      });
      if (!self.document.hidden) self.handleViewportChange();
    };
    this.document.addEventListener("visibilitychange", this.visibilityHandler);

    this.viewportHandler = function () { self.scheduleMeasurements(); };
    global.addEventListener("resize", this.viewportHandler);
    this.visualViewport = global.visualViewport || null;
    if (this.visualViewport && this.visualViewport.addEventListener) {
      this.visualViewport.addEventListener("resize", this.viewportHandler);
    }
    this.fullscreenHandler = function () { self.handleViewportChange(); };
    this.document.addEventListener("fullscreenchange", this.fullscreenHandler);
    this.messageHandler = function (event) {
      if (!event || !event.data || event.data.type !== "telemark:simulator-fullscreen-state") return;
      if (global.location && event.origin && event.origin !== global.location.origin) return;
      if (global.parent && global.parent !== global && event.source && event.source !== global.parent) return;
      self.handleViewportChange(Boolean(event.data.fullscreen));
    };
    global.addEventListener("message", this.messageHandler);
    this.storageHandler = function (event) {
      if (!event || event.key !== self.storageKey() || self.dragState) return;
      self.loadPersistedOrDefault();
      self.render();
      self.announce("Workspace layout updated.");
    };
    global.addEventListener("storage", this.storageHandler);
    if (typeof global.ResizeObserver === "function") {
      this.resizeObserver = new global.ResizeObserver(function () { self.scheduleMeasurements(); });
      this.resizeObserver.observe(this.scroll);
    }
    this.scheduleMeasurements();
  };

  Workspace.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scroll.classList.remove("sim-workspace-dragging");
    this.document.removeEventListener("pointermove", this.documentPointerMoveHandler);
    this.document.removeEventListener("pointerup", this.documentPointerUpHandler);
    this.document.removeEventListener("pointercancel", this.documentPointerCancelHandler);
    this.document.removeEventListener("pointerdown", this.outsidePointerHandler);
    this.document.removeEventListener("keydown", this.keydownHandler);
    this.document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.document.removeEventListener("fullscreenchange", this.fullscreenHandler);
    global.removeEventListener("resize", this.viewportHandler);
    global.removeEventListener("message", this.messageHandler);
    global.removeEventListener("storage", this.storageHandler);
    if (this.visualViewport && this.visualViewport.removeEventListener) {
      this.visualViewport.removeEventListener("resize", this.viewportHandler);
    }
    if (this.resizeObserver) this.resizeObserver.disconnect();
    cancelFrame(this.measureFrame);
    cancelFrame(this.contentResizeFrame);
    global.clearTimeout(this.fullscreenSettleTimer);
    this.gamepadFitters.forEach(function (fitter) { fitter.destroy(); });
    this.gamepadFitters.clear();
    this.lifecycle.forEach(function (hooks, identifier) {
      if (!this.lifecycleMounted.has(identifier)) return;
      try {
        if (this.lifecycleState.get(identifier) && typeof hooks.pause === "function") hooks.pause();
        if (typeof hooks.unmount === "function") hooks.unmount();
      } catch (error) {
        console.error("[Simulator widget lifecycle]", error);
      }
      emitVisibility(this, identifier, false, "workspace-destroyed");
    }, this);
    this.lifecycleMounted.clear();
    this.originals.slice().reverse().forEach(function (original) {
      if (!original.parent) return;
      if (original.nextSibling && original.nextSibling.parentNode === original.parent) {
        original.parent.insertBefore(original.node, original.nextSibling);
      } else {
        original.parent.appendChild(original.node);
      }
    });
    this.dormantNodes.forEach(function (entry) {
      entry.node.removeAttribute("data-sim-workspace-dormant");
      if (entry.ariaHidden === null) entry.node.removeAttribute("aria-hidden");
      else entry.node.setAttribute("aria-hidden", entry.ariaHidden);
      entry.node.inert = entry.inert;
    });
    this.dormantNodes = [];
    [this.scroll, this.vault, this.liveRegion, this.palette, this.addButton].forEach(function (node) {
      if (node && node.parentNode) node.remove();
    });
    this.document.documentElement.removeAttribute("data-sim-workspace");
    this.document.documentElement.removeAttribute("data-sim-host-fullscreen");
    if (activeWorkspace === this) activeWorkspace = null;
  };

  function mount(options) {
    if (activeWorkspace) activeWorkspace.destroy();
    activeWorkspace = new Workspace(options);
    return activeWorkspace;
  }

  function proxy(method, fallback) {
    return function () {
      if (!activeWorkspace || typeof activeWorkspace[method] !== "function") return fallback;
      return activeWorkspace[method].apply(activeWorkspace, arguments);
    };
  }

  const api = {
    mount: mount,
    registerWidget: proxy("registerWidget", null),
    setWidgetAvailability: proxy("setWidgetAvailability", false),
    getLayout: proxy("getLayout", []),
    setLayout: proxy("setLayout", false),
    exportLayout: proxy("exportLayout", "[]"),
    importLayout: proxy("importLayout", false),
    resetLayout: proxy("resetLayout", false),
    registerWidgetLifecycle: proxy("registerWidgetLifecycle", null),
    setLessonId: proxy("setLessonId", false),
    destroy: proxy("destroy", null),
    isWidgetActive: proxy("isWidgetActive", false),
    helpers: Object.freeze({
      columns: COLUMNS,
      rowHeight: ROW_HEIGHT,
      gap: GAP,
      overlaps: overlaps,
      collides: collides,
      validateLayout: validateLayout,
      firstOpenSlot: firstOpenSlot,
      pointToCell: pointToCell,
      normalizeBounds: normalizeBounds,
      copyRecord: copyRecord,
    }),
  };

  global.TelemarkSimulatorWorkspace = Object.freeze(api);
})(typeof window !== "undefined" ? window : globalThis);
