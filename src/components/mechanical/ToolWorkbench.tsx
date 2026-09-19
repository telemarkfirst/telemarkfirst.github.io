import {useLocation} from '@docusaurus/router';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {trackEvent} from '@site/src/telemark/analytics';
import {TOOL_CATALOG, TOOL_GROUPS, type ToolEntry} from './toolCatalog';
import styles from './ToolWorkbench.module.css';

/**
 * A bench for the design tools.
 *
 * The tools used to be stacked under tabs, which meant scrolling past three
 * calculators to reach the fourth. This is the layout a CAD or graphing tool
 * uses instead: a searchable rail of everything available, one canvas showing
 * the selected tool, and a toolbar that can take it fullscreen. Each tool also
 * links back to the lesson that explains what its numbers mean.
 */
export default function ToolWorkbench({
  initialToolId,
}: {
  initialToolId?: string;
}): React.JSX.Element {
  // A lesson links here as /simulator#gear-ratio, so the bench opens on the
  // tool the student was just reading about rather than on the first one.
  const [activeId, setActiveId] = useState(() => {
    if (initialToolId) return initialToolId;
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (TOOL_CATALOG.some((t) => t.id === hash)) return hash;
    }
    return TOOL_CATALOG[0].id;
  });
  const [query, setQuery] = useState('');
  const shellRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Changing only the hash does not remount, so the initialiser above never
  // re-runs. Watching the router's location covers in-app navigation, which
  // the browser's hashchange event does not: a client-side push to
  // /simulator#deflection updates history without ever firing it, so the URL
  // changed while the bench stayed on the previous tool.
  const {hash} = useLocation();
  useEffect(() => {
    const id = hash.replace('#', '');
    if (TOOL_CATALOG.some((t) => t.id === id)) setActiveId(id);
  }, [hash]);

  const active: ToolEntry =
    TOOL_CATALOG.find((t) => t.id === activeId) ?? TOOL_CATALOG[0];

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return TOOL_CATALOG;
    return TOOL_CATALOG.filter((tool) =>
      `${tool.name} ${tool.group} ${tool.keywords}`.toLowerCase().includes(needle),
    );
  }, [query]);

  async function toggleFullscreen() {
    const node = shellRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    await node.requestFullscreen();
    setFullscreen(true);
    trackEvent('simulator_fullscreen', {simulator: active.name});
  }

  function select(tool: ToolEntry) {
    setActiveId(tool.id);
    trackEvent('calculator_used', {calculator: tool.id, surface: 'workbench'});
  }

  return (
    <div className={styles.shell} ref={shellRef}>
      <div className={styles.rail}>
        <div className={styles.railSearch}>
          <input
            className={styles.railInput}
            type="search"
            value={query}
            placeholder="Filter tools"
            aria-label="Filter tools"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className={styles.railList} role="listbox" aria-label="Design tools">
          {matches.length === 0 && (
            <p className={styles.railEmpty}>No tool matches that.</p>
          )}
          {TOOL_GROUPS.map((group) => {
            const inGroup = matches.filter((tool) => tool.group === group);
            if (inGroup.length === 0) return null;
            return (
              <React.Fragment key={group}>
                <p className={styles.railGroup}>{group}</p>
                {inGroup.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    role="option"
                    aria-selected={tool.id === active.id}
                    className={`${styles.railItem} ${
                      tool.id === active.id ? styles.railItemActive : ''
                    }`}
                    onClick={() => select(tool)}
                  >
                    {tool.name}
                  </button>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className={styles.canvas}>
        <div className={styles.toolbar}>
          <span className={styles.toolChip}>{active.group}</span>
          <span className={styles.toolName}>{active.name}</span>
          <button type="button" className={styles.toolAction} onClick={toggleFullscreen}>
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>

        <div className={styles.surface}>
          <div className={styles.surfaceInner}>
            {/* Keyed so switching tools remounts rather than carrying the
                previous tool's state into a different set of inputs. */}
            <React.Fragment key={active.id}>{active.render()}</React.Fragment>

            <p className={styles.lessonLink}>
              What these numbers mean:{' '}
              <Link to={active.lesson.path}>{active.lesson.label}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
