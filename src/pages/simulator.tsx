import React, {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import {useLocation} from '@docusaurus/router';
import pageStyles from './simulator.module.css';
import AuthenticatedSimulatorNavigator from '../components/AuthenticatedSimulatorNavigator';
import ToolWorkbench from '../components/mechanical/ToolWorkbench';
import {TOOL_CATALOG} from '../components/mechanical/toolCatalog';

type Bench = 'software' | 'mechanical';

/**
 * Every interactive tool on the site, in one place.
 *
 * The page used to hold only the Java simulator, which meant a student on the
 * mechanical track had no reason to open it. Both benches now live here under
 * the same shell, matching how the two tracks are presented everywhere else.
 */

export default function SimulatorPage(): React.JSX.Element {
  const [bench, setBench] = useState<Bench>('software');
  const {hash} = useLocation();

  // Router navigation can change the hash without a native hashchange event.
  // Read it after hydration so server and first client render agree.
  useEffect(() => {
    if (TOOL_CATALOG.some((tool) => tool.id === hash.replace('#', ''))) setBench('mechanical');
  }, [hash]);

  return (
    <Layout title="Tools · Telemark" noFooter>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        rel="stylesheet"
      />

      <main className={pageStyles.lp}>
        <section className={pageStyles.section}>
          <h1 className={pageStyles.sectionTitle}>Simulators and calculators</h1>

          <div className={pageStyles.benchTabs} role="tablist" aria-label="Choose a bench">
            {([
              ['software', 'Java simulator'],
              ['mechanical', 'Design calculators'],
            ] as [Bench, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={bench === id}
                className={`${pageStyles.benchTab} ${bench === id ? pageStyles.benchTabActive : ''}`}
                onClick={() => setBench(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {bench === 'software' ? (
            <AuthenticatedSimulatorNavigator
              simulatorId="simulator_page_navigator"
              wrapperClassName={pageStyles.simulatorWrapper}
              toolbarClassName={pageStyles.simulatorToolbar}
              toolbarButtonClassName={pageStyles.simulatorToolbarButton}
            />
          ) : (
            <ToolWorkbench />
          )}
        </section>
      </main>
    </Layout>
  );
}
