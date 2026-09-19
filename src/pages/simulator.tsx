import React, {useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import pageStyles from './simulator.module.css';
import AuthenticatedSimulatorNavigator from '../components/AuthenticatedSimulatorNavigator';
import SimulatorWorkflow from '../components/SimulatorWorkflow';
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

const MECHANICAL_STEPS = [
  ['1', 'Bring real numbers', 'Weigh the arm, measure the wheel, read the motor spec page.'],
  ['2', 'Enter the design', 'Enter the dimensions and parts you plan to use.'],
  ['3', 'Read the result', 'Check the drawing, calculated load, and safety factor.'],
  ['4', 'Change one thing', 'Adjust one ratio, length, or spool size and compare the result.'],
] as const;

function MechanicalWorkflow(): React.JSX.Element {
  return (
    <div className={pageStyles.simulatorWorkflow} aria-label="Calculator workflow">
      {MECHANICAL_STEPS.map(([number, title, description]) => (
        <div className={pageStyles.simulatorStep} key={number}>
          <span>{number}</span>
          <div>
            <strong>{title}</strong>
            <p>{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SimulatorPage(): React.JSX.Element {
  const [bench, setBench] = useState<Bench>(() => {
    if (typeof window === 'undefined') return 'software';
    // Arriving from a lesson's "open in the workbench" link lands on the
    // calculators, not on the Java simulator.
    return TOOL_CATALOG.some((t) => t.id === window.location.hash.replace('#', ''))
      ? 'mechanical'
      : 'software';
  });

  // A lesson link arriving while the page is already open should also switch
  // to the calculators, not leave the visitor on the Java simulator.
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '');
      if (TOOL_CATALOG.some((t) => t.id === hash)) setBench('mechanical');
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <Layout title="Tools · Telemark" noFooter>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
        rel="stylesheet"
      />

      <main className={pageStyles.lp}>
        <section className={pageStyles.section}>
          <h1 className={pageStyles.sectionTitle}>Telemark Tools</h1>
          <p className={pageStyles.sectionDesc}>
            Run lesson code in the Java simulator, or use {TOOL_CATALOG.length}{' '}
            calculators to check a mechanical design before fabrication.
          </p>

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
            <>
              <SimulatorWorkflow
                className={pageStyles.simulatorWorkflow}
                itemClassName={pageStyles.simulatorStep}
                taskClassName={pageStyles.simulatorTasks}
              />
              <p className={pageStyles.simulatorLimit}>
                Simulation checks code and modeled behavior. Use a physical
                robot to verify wiring, motor direction, traction, and final
                tuning.
              </p>

              <AuthenticatedSimulatorNavigator
                simulatorId="simulator_page_navigator"
                wrapperClassName={pageStyles.simulatorWrapper}
                toolbarClassName={pageStyles.simulatorToolbar}
                toolbarButtonClassName={pageStyles.simulatorToolbarButton}
              />

              <div className={pageStyles.heroActions}>
                <Link to="/docs" className={pageStyles.btnSecondary}>
                  Software track
                </Link>
                <Link to="/docs/unit-00/classes-and-objects" className={pageStyles.btnPrimary}>
                  Begin Unit 0
                </Link>
              </div>
            </>
          ) : (
            <>
              <MechanicalWorkflow />

              <ToolWorkbench />

              <p className={pageStyles.simulatorLimit}>
                Calculators check dimensions, loads, and safety factors. Use a
                physical prototype to test grip, friction, and game element
                behavior.
              </p>

              <div className={pageStyles.heroActions}>
                <Link to="/mechanical" className={pageStyles.btnSecondary}>
                  Mechanical track
                </Link>
                <Link to="/mechanical/module-00/design-cycle" className={pageStyles.btnPrimary}>
                  Begin Module 0
                </Link>
              </div>
            </>
          )}
        </section>
      </main>
    </Layout>
  );
}
