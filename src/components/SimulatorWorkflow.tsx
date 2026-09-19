import React from 'react';

interface SimulatorWorkflowProps {
  className?: string;
  itemClassName?: string;
  taskClassName?: string;
}

const STEPS = [
  ['1', 'Write Java', 'Complete the lesson code in the browser editor.'],
  ['2', 'Run the OpMode', 'Press Init and Start, then use the gamepad or scene controls.'],
  ['3', 'Read the robot', 'Compare telemetry, visual motion, requirements, and hints.'],
  ['4', 'Fix and retry', 'Change the code and reinitialize until the behavior matches the goal.'],
] as const;

const TASKS = [
  'Fix a drivetrain with the wrong motor direction.',
  'Stop a slide at an encoder target.',
  'Diagnose unsafe or unreliable sensor data.',
] as const;

export default function SimulatorWorkflow({
  className,
  itemClassName,
  taskClassName,
}: SimulatorWorkflowProps): React.JSX.Element {
  return (
    <>
      <div className={className} aria-label="Simulator workflow">
        {STEPS.map(([number, title, description]) => (
          <div className={itemClassName} key={number}>
            <span>{number}</span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={taskClassName} aria-label="Example simulator tasks">
        {TASKS.map((task) => <span key={task}>{task}</span>)}
      </div>
    </>
  );
}
