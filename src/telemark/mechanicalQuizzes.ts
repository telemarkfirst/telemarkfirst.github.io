import type {QuizQuestion} from '@site/src/components/mechanical/ScoredQuiz';

/**
 * Scored questions for each engineering module's mastery quiz.
 *
 * These complement the written questions in the quiz pages rather than
 * replacing them. The written ones are for reasoning something through; these
 * check whether it stuck, and every wrong option is a misconception teams
 * actually hold rather than filler.
 */
export const MASTERY_QUESTIONS: Record<string, QuizQuestion[]> = {
  'module-00': [
    {
      prompt: 'A scoring action is worth 6 points and takes 9 seconds. Another is worth 2 points and takes 4 seconds. Which is the better target on points per second alone?',
      options: ['The 6 point action, at 0.67 per second', 'The 2 point action, at 0.5 per second', 'They are equal', 'Points per second cannot be compared across actions'],
      answer: 0,
      explain: '6/9 = 0.67 against 2/4 = 0.5. That ranks them, but it does not settle the strategy: if the 9 second estimate ignores alignment time, the ranking can flip.',
    },
    {
      prompt: 'Which of these is a constraint rather than a requirement?',
      options: ['The robot must score in the high goal', 'The robot must fit the starting size limit', 'The robot should cycle in under 10 seconds', 'The team will use mecanum wheels'],
      answer: 1,
      explain: 'The size limit comes from the manual and cannot be negotiated. Scoring high and cycle time are requirements you chose and could drop. Mecanum is a preference stated as though it were a constraint.',
    },
    {
      prompt: 'Why should the generating and judging phases of a brainstorm be separated?',
      options: ['To make the meeting shorter', 'Because judging during generation makes people stop proposing ideas', 'Because bad ideas should never be written down', 'So the team lead can decide alone'],
      answer: 1,
      explain: 'Immediate criticism narrows the discussion before the team has generated enough alternatives. Separate the phases so each idea can be developed before the group compares it against the requirements.',
    },
    {
      prompt: 'A prototype takes two weeks to build. What is the main problem with that?',
      options: ['It costs too much material', 'It answers the question too late to act on, and becomes too expensive to throw away', 'Prototypes should always be made from metal', 'Nothing, thorough prototypes are better'],
      answer: 1,
      explain: 'A prototype needs to answer its question early enough for the team to change direction. A two-week build delays that result and makes the team less willing to discard a weak concept.',
    },
    {
      prompt: 'Your team rejected three intake concepts. Why write down the reasons?',
      options: ['Only to satisfy judges', 'Because the chosen concept may fail later and half the analysis is already done', 'To prove the team works hard', 'There is no reason to record rejected ideas'],
      answer: 1,
      explain: 'The notes explain the original decision and give the team a starting point if the chosen concept later fails. Recheck the alternatives using what the tests have since shown.',
    },
  ],
  'module-01': [
    {
      prompt: 'Which notebook entry is most useful to a judge and to your team?',
      options: ['"Worked on the intake today, made good progress"', '"Intake acquired 7 of 12 elements at 2 in offset. Each failure rode up the funnel wall. Next: increase funnel angle to 35 degrees."', '"The intake is done and works great"', 'A photograph of the intake with no caption'],
      answer: 1,
      explain: 'It states the measurement, the trial count, the observed failure mode, and the next step. The others are opinions or undated activity logs.',
    },
    {
      prompt: 'How many trials are needed before calling a mechanism competition ready?',
      options: ['1', '3', '10', '25 or more'],
      answer: 3,
      explain: 'Three trials shows basic feasibility and ten gives rough reliability. A figure you can plan a match strategy around needs 25 or more.',
    },
    {
      prompt: 'In a weighted decision matrix, when must the criteria be weighted?',
      options: ['After scoring, so the weights reflect the results', 'Before the options are scored', 'It does not matter', 'Only if the team disagrees'],
      answer: 1,
      explain: 'Weighting after scoring lets the team adjust the criteria around a preferred result. Set the weights first so they represent the strategy instead of the current favorite.',
    },
    {
      prompt: 'Concept A scores 61 and concept B scores 59 in your matrix. What should you do?',
      options: ['Build A, it won', 'Rerun the matrix with different weights until one clearly wins', 'Prototype both, because the gap is smaller than the scoring noise', 'Pick whichever is cheaper'],
      answer: 2,
      explain: 'A 2 point margin is smaller than the uncertainty in subjective 1 to 5 scores. Treat the concepts as tied and compare rough prototypes with measured results.',
    },
    {
      prompt: 'A trial fails because someone bumped the robot. What should the notebook say?',
      options: ['Nothing, discard it', 'Record it as a bumped trial with the reason', 'Count it as a normal failure', 'Restart the whole test from zero'],
      answer: 1,
      explain: 'Record the trial, identify the bump, and state whether it was excluded from the reliability calculation. Another reader can then reproduce how the result was calculated.',
    },
  ],
  'module-02': [
    {
      prompt: 'Why must gloves be removed before using a drill press?',
      options: ['They reduce grip on the workpiece', 'A caught glove pulls the whole hand into the tool, where bare skin would tear free', 'They are uncomfortable', 'They are only needed for chemicals'],
      answer: 1,
      explain: 'Gloves are right for handling sharp stock and wrong near any rotating spindle, because the glove is continuous material that wraps.',
    },
    {
      prompt: 'The tap drill for M4 x 0.7 is closest to which size?',
      options: ['4.5 mm', '4.0 mm', '3.3 mm', '2.5 mm'],
      answer: 2,
      explain: 'Tap drill is roughly major diameter minus pitch: 4 - 0.7 = 3.3 mm. 4.5 mm is the free clearance size, and 2.5 mm is the M3 tap drill.',
    },
    {
      prompt: 'Chips coming off an aluminum cut are turning blue. What does that mean?',
      options: ['The cut is going well', 'The tool is too sharp', 'Too much heat, so slow the feed and add lubricant', 'The material is not really aluminum'],
      answer: 2,
      explain: 'Blue chips mean excessive heat. Hot aluminum welds to the cutting edge, which dulls it and generates more heat, so pushing harder makes it worse.',
    },
    {
      prompt: 'Why should you not lay out hole positions measured from a freshly bandsawn edge?',
      options: ['It is faster to measure from the middle', 'A cut edge is not straight or square enough to be a reference surface', 'Bandsaw edges are too smooth to mark', 'You should always measure from the longest edge'],
      answer: 1,
      explain: 'Reference from an original extruded or machined surface, and record which edge you used so the next person uses the same one.',
    },
    {
      prompt: 'An M3 screw is tapped into 1/8 in aluminum plate. What is the concern?',
      options: ['The screw is too long', '3.175 mm of engagement is below the 1.5x diameter guideline of 4.5 mm', 'M3 cannot be tapped into aluminum', 'The plate will be too heavy'],
      answer: 1,
      explain: 'The threads will strip below the screw’s own capacity. Use a nut, a threaded insert, tap into a thicker web, or accept the reduced strength deliberately.',
    },
  ],
  'module-03': [
    {
      prompt: 'A frame rail bends 0.2 in under a hit and springs back undamaged. Why is this still a problem?',
      options: ['It is not a problem, nothing broke', 'Mechanisms depend on geometry, so the intake moves 0.2 in and stops working during the hit', 'The rail will eventually fatigue', 'It makes the robot heavier'],
      answer: 1,
      explain: 'The rail was strong enough but not stiff enough. Because nothing breaks, the symptom looks intermittent and can be misdiagnosed as software or driver error.',
    },
    {
      prompt: 'A 16 in rail deflects too much. Which change helps most for the least weight?',
      options: ['Switch from aluminum to steel', 'Add a support at the midpoint', 'Make the wall 50% thicker', 'Use a wider section'],
      answer: 1,
      explain: 'Deflection scales with the cube of span, so halving it cuts deflection to one eighth. Steel only gains a factor of about three and roughly triples the weight.',
    },
    {
      prompt: 'A 0.5 by 1.5 in bar is loaded flat instead of on edge. How much more does it deflect?',
      options: ['3 times', '9 times', '2 times', 'The same, orientation does not matter'],
      answer: 1,
      explain: 'I = b*h^3/12, so height is cubed. (1.5/0.5)^2 = 9. Orientation is free stiffness, which is why it is checked before material changes.',
    },
    {
      prompt: 'Where should a polycarbonate plate NOT be used?',
      options: ['As a guard over electronics', 'As an intake side wall', 'As a plate locating two shafts that must stay parallel', 'As a ball deflector'],
      answer: 2,
      explain: 'Polycarbonate has roughly a thirtieth of aluminum’s stiffness and creeps under sustained load, so the shafts will not stay parallel.',
    },
    {
      prompt: 'When cutting weight, where should you look first?',
      options: ['The lightest subsystem, since it is easiest', 'The heaviest subsystem, and weight high or far out on the robot', 'The fasteners', 'The battery'],
      answer: 1,
      explain: 'A 10% cut on the heaviest item saves more than deleting a small part. A pound at the end of an extended arm costs torque, tipping margin, and structure.',
    },
  ],
  'module-04': [
    {
      prompt: 'A bolted joint is snug but not properly tightened. What happens under load?',
      options: ['Nothing, the screw is strong enough', 'The parts shift within the clearance hole because there is little clamping force', 'The screw stretches permanently', 'The threads strip immediately'],
      answer: 1,
      explain: 'A tightened screw stretches and clamps the faces together. Friction between those faces carries the load. Without clamping, the load goes into the screw in shear and the parts move, which you feel as slop.',
    },
    {
      prompt: 'One screw keeps backing out even after blue threadlocker. What is the likely cause?',
      options: ['The threadlocker was the wrong color', 'The joint itself is moving under load, so the fix is structural', 'The screw is too long', 'Stainless screws always loosen'],
      answer: 1,
      explain: 'Repeated loosening in one place usually means relative motion between the parts. Add a second fastener spaced away, add a locating feature, or stiffen the member.',
    },
    {
      prompt: 'What most improves a set screw holding a hub on a round shaft?',
      options: ['More torque on the set screw', 'A longer set screw', 'Aligning it with a machined flat on the shaft', 'A larger diameter shaft'],
      answer: 2,
      explain: 'A set screw on a curved surface holds by point contact and rocks loose. A flat gives it a face to bear on. Better still is a clamping hub that grips the full circumference.',
    },
    {
      prompt: 'A sprocket is cantilevered 3 in beyond two bearings that are 1 in apart. What is the first fix?',
      options: ['Use a stronger shaft', 'Increase the bearing spacing', 'Add threadlocker', 'Use a larger sprocket'],
      answer: 1,
      explain: 'Reaction forces scale with cantilever length over bearing spacing. Widen the bearing spacing first, then shorten the cantilever if needed.',
    },
    {
      prompt: 'Why should washers not be used as spacers in a stack-up?',
      options: ['They are too heavy', 'Their thickness is not a controlled dimension, so position error accumulates', 'They corrode', 'They cannot be bought in the right sizes'],
      answer: 1,
      explain: 'Washer thickness varies. Use spacers with a specified length, and keep washers for spreading load under a fastener head.',
    },
  ],
  'module-05': [
    {
      prompt: 'What can CAD NOT tell you about an intake?',
      options: ['Whether it fits the starting envelope', 'Whether it interferes with the frame at 40 degrees', 'Whether it actually grips the game element', 'Whether it reaches the scoring position'],
      answer: 2,
      explain: 'CAD checks geometry. Friction, compliance, and how an element tumbles are physical behavior and need a prototype.',
    },
    {
      prompt: 'Why fully define every sketch before leaving it?',
      options: ['It makes the file smaller', 'Under-defined geometry moves unpredictably when a dimension changes later', 'It is required by the software', 'It speeds up rendering'],
      answer: 1,
      explain: 'The part looks correct either way. The cost is paid at the first edit, usually by whoever inherits the model.',
    },
    {
      prompt: 'Two holes must stay symmetric about a plate’s center. What is the right way to model that?',
      options: ['Two dimensions from the left edge', 'A symmetry constraint', 'One dimension and a copy', 'Place them by eye and lock them'],
      answer: 1,
      explain: 'Dimensions from one edge encode positions. A symmetry constraint encodes intent, so the holes stay symmetric when the plate width changes.',
    },
    {
      prompt: 'An arm pivot is modeled with a fastened mate instead of a revolute mate. What is lost?',
      options: ['Nothing, it is simpler', 'The assembly can never be driven through its range, so interference is only ever checked at one position', 'The mass properties become wrong', 'The drawing cannot be generated'],
      answer: 1,
      explain: 'Collisions frequently occur mid travel. An arm can clear at 0 and 110 degrees and strike the frame at 40.',
    },
    {
      prompt: 'Why reference a published version of an external document rather than its latest state?',
      options: ['It loads faster', 'Otherwise someone editing that document silently changes your assembly', 'Versions use less storage', 'The software requires it'],
      answer: 1,
      explain: 'Referencing the tip means your model can break with no corresponding entry in your own edit history, which makes the cause very hard to find.',
    },
  ],
  'module-06': [
    {
      prompt: 'A mechanism uses half of its available stall torque. Roughly what speed does it run at?',
      options: ['Free speed', 'About half of free speed', 'About a quarter of free speed', 'Zero'],
      answer: 1,
      explain: 'Torque and speed trade linearly between the two endpoints, so half the stall torque leaves about half the free speed. Cycle times based on free speed are about twice too optimistic.',
    },
    {
      prompt: 'Where does a DC motor deliver peak mechanical power?',
      options: ['At free speed', 'At stall', 'At half free speed and half stall torque', 'Just below stall'],
      answer: 2,
      explain: 'Power is torque multiplied by speed. Since torque falls linearly as speed rises, their product peaks at the midpoint of the motor curve.',
    },
    {
      prompt: 'Three stages of 4:1, 3:1, and 5:1 give what overall reduction?',
      options: ['12:1', '60:1', '20:1', '35:1'],
      answer: 1,
      explain: 'Reductions in series multiply: 4 x 3 x 5 = 60. At 95% per stage the efficiency compounds to about 86%, not 95%.',
    },
    {
      prompt: 'Roller chain must be ordered in what link count?',
      options: ['Any count', 'An even count, to close without an offset link', 'An odd count', 'A multiple of five'],
      answer: 1,
      explain: 'Timing belts come in fixed tooth counts instead, so with belts you pick a stock length and place the shafts at the center distance it needs.',
    },
    {
      prompt: 'An arm does not stop in the same place twice, though the encoder readings are consistent. What is the mechanical cause?',
      options: ['The encoder is broken', 'Backlash between the motor and the arm', 'The battery is low', 'The motor is undersized'],
      answer: 1,
      explain: 'The encoder measures the motor, not the arm. Backlash from each stage sums at the output, so the arm can sit anywhere within that play.',
    },
  ],
  'module-07': [
    {
      prompt: 'A student proposes wider drive wheels to increase pushing force. Is that right?',
      options: ['Yes, more contact area means more grip', 'No, friction force is mu times normal force and area does not appear', 'Yes, but only on soft tread', 'Only if the robot is heavy'],
      answer: 1,
      explain: 'Wider wheels help wear, load spreading, and behavior on uneven surfaces. For pushing force, the levers are tread compound, weight on driven wheels, and reduction.',
    },
    {
      prompt: 'Which is the safe side to design toward?',
      options: ['Motor limited, so the wheels never slip', 'Traction limited, so the wheels slip before the motors stall', 'Neither matters', 'Whichever gives more top speed'],
      answer: 1,
      explain: 'A stalled motor draws full stall current, makes no motion, and turns it all into heat. Slipping wheels protect the motors and give the driver a predictable limit.',
    },
    {
      prompt: 'A team adds 5 lb of ballast low in the chassis. What happens?',
      options: ['Both pushing force and acceleration improve', 'Pushing force improves, acceleration is roughly unchanged', 'Acceleration improves, pushing force is unchanged', 'Neither changes'],
      answer: 1,
      explain: 'Traction scales with weight, so pushing force rises. Acceleration is force over mass, and both went up together, so the ratio is about the same.',
    },
    {
      prompt: 'Middle wheels lift slightly during hard acceleration. Name a consequence beyond lost traction.',
      options: ['The battery drains faster', 'Their encoders report counts that do not correspond to travel', 'The motors reverse', 'The wheels wear faster'],
      answer: 1,
      explain: 'A powered wheel with no load spins freely, corrupting any position estimate that uses drive encoders, at exactly the moment accuracy matters most.',
    },
    {
      prompt: 'An autonomous routine works on one robot and drifts on its identical twin, with the same code. Most likely cause?',
      options: ['A software bug', 'Different measured odometry wheel diameters and pod offsets', 'A different battery', 'Different motors'],
      answer: 1,
      explain: 'The code depends on measured mechanical values. A 1% wheel diameter error is roughly 1 in over an 8 ft traverse, and offset errors grow with every turn.',
    },
  ],
  'module-08': [
    {
      prompt: 'An intake fails one attempt in five. Why is that worse than being half a second slower per cycle?',
      options: ['It is not worse', 'A failure costs a full retry cycle, not half a second', 'It looks bad to judges', 'It drains the battery'],
      answer: 1,
      explain: 'A failed acquisition means repositioning and reapproaching, often several seconds, plus disruption to the driver’s rhythm. Reliability is the design target.',
    },
    {
      prompt: 'A three stage cascading slide is chosen for speed. What happens to the lifting force?',
      options: ['It triples', 'It is unchanged', 'It is divided by three', 'It depends only on the motor'],
      answer: 2,
      explain: 'Speed and force trade exactly. Sizing the motor for extension speed and forgetting the force division is why a slide cannot lift its load.',
    },
    {
      prompt: 'At what arm angle is gravity torque highest?',
      options: ['Vertical, pointing up', 'Horizontal', '45 degrees', 'It is constant'],
      answer: 1,
      explain: 'Torque follows cos(theta) from horizontal, so cosine is 1 at horizontal and 0 at vertical. An arm sized at its stowed position will stall on the way through.',
    },
    {
      prompt: 'Why is a counterbalance stronger than gravity a problem?',
      options: ['It wastes material', 'The arm drives itself upward, and does so uncontrolled when the motor is unpowered', 'It makes the arm too slow', 'It is not a problem, more margin is better'],
      answer: 1,
      explain: 'The motor then has to fight the spring downward, which is the same continuous torque problem reversed, and it is unsafe when power is removed.',
    },
    {
      prompt: 'A slide moves freely by hand on the bench and stalls loaded at full extension. Why?',
      options: ['The motor is undersized', 'Under load the extended stages deflect, the rails go out of parallel, and friction rises', 'The string is too thin', 'The spool is too large'],
      answer: 1,
      explain: 'Deflection scales with the cube of extended length, and the bench test barely deflects. Test at the extreme of travel with the real load.',
    },
  ],
  'module-09': [
    {
      prompt: 'Voltage drop must be calculated over what length?',
      options: ['The one way run', 'Twice the one way run, because current flows out and back', 'Half the run', 'The straight line distance'],
      answer: 1,
      explain: 'Using the one way length halves the answer and always errs optimistically, which is why the mistake goes unnoticed until the robot underperforms.',
    },
    {
      prompt: 'A motor works on the bench and cuts out during matches, and the wire looks undamaged. What is the likely cause?',
      options: ['A software bug', 'The conductor has fatigued and broken inside intact insulation, near the connector', 'The motor is failing', 'The battery is too small'],
      answer: 1,
      explain: 'Cable movement transfers into the connector, flexing the conductor where it is crimped. Anchor within a few inches with a service loop.',
    },
    {
      prompt: 'Which of these is the authoritative source for legal wiring?',
      options: ['Another team’s robot that passed inspection', 'A popular forum post', 'The current season’s game manual', 'Last season’s manual'],
      answer: 2,
      explain: 'Requirements change between seasons, other teams’ robots may have been missed at inspection, and an inspector works from the manual.',
    },
    {
      prompt: 'Why label every wire at both ends with the configuration name?',
      options: ['It looks professional', 'Because the code asks for that name, and diagnosis between matches takes minutes without labels', 'Inspectors require colored labels', 'It prevents shorts'],
      answer: 1,
      explain: 'If a wire moves and the configuration is not updated, the robot misbehaves in a way that is invisible from the code.',
    },
    {
      prompt: 'After fixing one failed inspection item, what should you do?',
      options: ['Recheck only that item', 'Run the whole checklist again from the top', 'Nothing, go queue', 'Ask another team to check'],
      answer: 1,
      explain: 'Fixing one item frequently disturbs another: rerouting a cable can leave it taut at full extension, and re-seating a connector can leave it partly engaged.',
    },
  ],
  'module-10': [
    {
      prompt: 'Why is building a prototype well usually a mistake?',
      options: ['It is a waste of good material', 'It consumes the time advantage and makes the team unwilling to discard it', 'Prototypes should never work', 'It confuses the judges'],
      answer: 1,
      explain: 'A prototype earns its value by answering the question early. Effort invested also triggers the sunk cost trap, turning an experiment into a commitment.',
    },
    {
      prompt: 'A mechanism goes from 8/10 to 9/10 after a change. Did the change help?',
      options: ['Yes, clearly', 'You cannot tell because that difference is within normal random variation', 'No, it got worse', 'Yes, by exactly 10%'],
      answer: 1,
      explain: 'Detecting a real difference needs enough trials that the change exceeds the noise, which for FTC purposes means 25 or more before and after.',
    },
    {
      prompt: 'Why should someone other than the builder run a reliability test?',
      options: ['The builder is biased about the design', 'The builder unconsciously operates it in the way that works, which a driver will not', 'It is faster', 'To train more team members'],
      answer: 1,
      explain: 'Approach speed, angle, and small corrections get applied automatically and invisibly, so the measured reliability reflects an operator the robot will not have.',
    },
    {
      prompt: 'A slide stops moving and the team replaces the motor. What is wrong with that response?',
      options: ['Nothing, the motor was the problem', '"The motor stalled" is a symptom; the cause is whatever made the load that high', 'They should have replaced the whole slide', 'Motors never fail'],
      answer: 1,
      explain: 'Keep asking why until you reach a design decision you control, such as a flexing plate causing the rails to bind.',
    },
    {
      prompt: 'Surgical tubing snaps after two months of use. How should this be classified?',
      options: ['A design failure needing a redesign', 'A build failure needing a checklist', 'A wear failure needing a replacement schedule and spares', 'An unpredictable event'],
      answer: 2,
      explain: 'Misclassifying wastes effort: redesigning a wear item spends hours on something working as intended.',
    },
  ],
  'module-11': [
    {
      prompt: 'Why is specifying every dimension to plus or minus 0.001 in a poor decision?',
      options: ['It is impossible to achieve', 'Tolerance is a cost, and it hides which dimensions actually matter', 'It makes the part heavier', 'Drawings cannot show that precision'],
      answer: 1,
      explain: 'Holding a thousandth needs reaming or boring and measurement of every feature. Applied everywhere, the fabricator cannot tell which features are real requirements.',
    },
    {
      prompt: 'A drilled hole and an FDM printed hole of the same nominal size differ how?',
      options: ['Both come out oversize', 'Both come out undersize', 'Drilled comes out oversize, printed comes out undersize', 'Drilled comes out undersize, printed comes out oversize'],
      answer: 2,
      explain: 'They err in opposite directions, so a precision drilled bore should be reamed and a printed hole should be modeled oversize or drilled after printing.',
    },
    {
      prompt: 'A printed bracket fails far below the load an equivalent aluminum part would carry. Most likely cause?',
      options: ['The plastic is defective', 'The load is trying to separate the print layers', 'The infill percentage is too low', 'The part is too thin overall'],
      answer: 1,
      explain: 'FDM parts are anisotropic and the layer bond is much weaker than material within a layer. Orientation is a design decision that belongs on the drawing.',
    },
    {
      prompt: 'A team measured the robot in the shop and still failed sizing at inspection. Most likely reason?',
      options: ['The inspector made a mistake', 'It was measured in a tidy configuration rather than the true starting configuration, or something was added since', 'The rules changed at the event', 'The sizing box was wrong'],
      answer: 1,
      explain: 'A guard, a thicker cable, or zip tie tails all count, and a robot measured exactly at the limit fails because measurement is not perfectly repeatable.',
    },
    {
      prompt: 'A mechanism breaks with two matches until yours. What is the first triage question?',
      options: ['How do we fix it properly?', 'Can the robot play safely without it?', 'Who broke it?', 'Should we forfeit?'],
      answer: 1,
      explain: 'A half completed proper repair means missing the match with the robot disassembled. Play degraded, swap a spare, or make a safe temporary fix, then repair properly later.',
    },
  ],
  'module-12': [
    {prompt: 'What is the minimum clearance for a screw passing through a hole?', options: ['0.05 mm per side', '0.15 mm per side', '0.5 mm per side', 'No clearance is needed'], answer: 1, explain: '0.15 mm per side, so 0.3 mm on the diameter. It has to absorb drill error, position error, fastener runout, and surface finish together.'},
    {prompt: 'The M3 close clearance hole is which size?', options: ['2.5 mm', '3.0 mm', '3.2 mm', '3.6 mm'], answer: 2, explain: '3.2 mm close, 3.4 mm free. 2.5 mm is the tap drill, and 3.0 mm is the screw itself, which binds.'},
    {prompt: 'Minimum thread engagement for M3 in aluminium?', options: ['1.5 mm', '3.0 mm', '4.5 mm', '9.0 mm'], answer: 2, explain: '1.5 times the diameter. 1/8 in plate is 3.175 mm, which is below standard, so use a nut, an insert, or a thicker section.'},
    {prompt: 'A shaft spins freely with one bearing and stiffly with both. What does that mean?', options: ['The bearings are the wrong size', 'The two bores are not coaxial', 'The shaft is too long', 'That is normal'], answer: 1, explain: 'The shaft bends to pass through both, which permanently loads the bearings and adds friction. Ten seconds to check during assembly, a spacer to fix.'},
    {prompt: 'Why is a safety factor of 6 also a mistake?', options: ['It is not, more margin is always better', 'Margin is bought with reduction, and reduction costs speed proportionally', 'It makes the part too heavy to move', 'It voids the warranty'], answer: 1, explain: 'An arm with six times the needed torque takes several seconds to raise and loses the cycle it was built for. Aim for 2 to 3 and spend the rest on speed.'},
  ],
  'module-13': [
    {prompt: 'Why does a compliant intake tolerate position error that a rigid claw cannot?', options: ['It grips harder', 'Grip force becomes a function of deformation rather than exact width', 'It moves faster', 'Compliant materials have higher friction'], answer: 1, explain: 'N is roughly kx once the element deforms the compliant part, so a few millimetres of error changes the grip a little instead of removing it entirely.'},
    {prompt: 'A three stage cascading lift extends three times as fast per rotation. What else is tripled?', options: ['Nothing, it is free', 'The force in the cable', 'The stage stiffness', 'The motor efficiency'], answer: 1, explain: 'Work is conserved, so the trade is the same as gearing for speed. This is why cascading lifts fail at the cable and its termination rather than in the slides.'},
    {prompt: 'What does a parallelogram four-bar guarantee?', options: ['Constant speed at the end effector', 'The far member stays parallel to the fixed member throughout the motion', 'Zero backlash', 'Maximum reach for a given bar length'], answer: 1, explain: 'It is an exact geometric result, not an approximation, which is why the end effector holds its angle with no sensor and no second motor.'},
    {prompt: 'How does a virtual four-bar fail?', options: ['The bar bends visibly', 'The belt skips a tooth, permanently and silently', 'It cannot reach full extension', 'The pivots seize'], answer: 1, explain: 'The angle is then wrong by that tooth for the rest of the match and nothing reports it. Belt tension and wrap angle are what prevent it.'},
    {prompt: 'Why does a dead wheel measure position better than a drive wheel?', options: ['It has a better encoder', 'It carries almost no load and transmits no torque, so it does not slip', 'It is larger', 'It is closer to the centre of the robot'], answer: 1, explain: 'It measures the floor rather than the motor. The general principle is that odometry works by decoupling measurement from actuation.'},
  ],
};

export const QUIZ_MODULE_COUNT = Object.keys(MASTERY_QUESTIONS).length;
