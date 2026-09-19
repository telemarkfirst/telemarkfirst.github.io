import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// Which track to export. Pass "mechanical" as the first argument; anything
// else, including no argument, builds the software curriculum.
const track = process.argv[2] === 'mechanical' ? 'mechanical' : 'software';

const TRACKS = {
  software: {
    title: 'Java for FTC Curriculum',
    htmlName: 'java-ftc-curriculum.html',
    pdfName: 'Java for FTC Curriculum.pdf',
    dataFile: 'src/telemark/curriculum.ts',
    docs: [
      'docs/learning-paths.mdx',
      ...Array.from({ length: 16 }, (_, i) =>
        listUnitDocs(`docs/unit-${String(i).padStart(2, '0')}`),
      ).flat(),
    ],
  },
  engineering: {
    title: 'Mechanical for FTC Curriculum',
    htmlName: 'mechanical-ftc-curriculum.html',
    pdfName: 'Mechanical for FTC Curriculum.pdf',
    dataFile: 'src/telemark/mechanical.ts',
    docs: [
      'engineering/getting-started.mdx',
      ...Array.from({ length: 13 }, (_, i) =>
        listUnitDocs(`mechanical/module-${String(i).padStart(2, '0')}`),
      ).flat(),
    ],
  },
};

const config = TRACKS[track];
const outHtml = path.join(root, 'build', config.htmlName);
const outPdf = path.join(root, config.pdfName);
const curriculumSource = readFileSync(path.join(root, config.dataFile), 'utf8');

const docs = config.docs;

function listUnitDocs(dir) {
  if (!existsSync(path.join(root, dir))) return [];
  return readdirSync(path.join(root, dir))
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join(dir, file))
    .filter((file) => !file.endsWith('_category_.mdx'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split('\n')) {
    const item = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!item) continue;
    data[item[1]] = item[2].replace(/^['"]|['"]$/g, '');
  }
  return { data, body: raw.slice(match[0].length) };
}

function inlineMd(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function diagram(name) {
  const nodes = {
    LifecycleDiagram: [
      ['Init pressed', 'init() runs once for setup and hardware mapping.'],
      ['Waiting', 'init_loop() may repeat until the match starts.'],
      ['Start pressed', 'start() runs once for timers or one-time transitions.'],
      ['Active match', 'loop() repeats: read inputs, decide, command hardware, telemetry.'],
      ['Stop pressed', 'stop() runs once for cleanup and safe shutdown.'],
    ],
    EncoderFlowDiagram: [
      ['Shaft rotates', 'The motor output shaft turns with the mechanism.'],
      ['Encoder pulses', 'The encoder sensor produces counts as it spins.'],
      ['Hub counter', 'The Control Hub accumulates ticks as an integer.'],
      ['Code reads', 'getCurrentPosition() returns the tick count.'],
      ['Robot logic', 'Code converts ticks into distance, angle, or position.'],
    ],
    RunToPositionDiagram: [
      ['Set target', 'setTargetPosition(ticks) defines the destination.'],
      ['Set mode', 'RUN_TO_POSITION enables position control.'],
      ['Apply power', 'setPower() provides the movement speed limit.'],
      ['Controller acts', 'The Hub compares current ticks to target ticks.'],
      ['Arrive', 'The mechanism stops near target and may hold position.'],
    ],
    PathFollowingDiagram: [
      ['Path geometry', 'A Pedro 3 Path defines one segment or combines several line() and curve() segments.'],
      ['Target pose', 'The Follower picks where the robot should be now.'],
      ['Pose error', 'Current odometry pose is compared to target pose.'],
      ['Motor correction', 'Drive powers update, the robot moves, odometry repeats.'],
    ],
    MeetingRhythmDiagram: [
      ['Read and simulate', 'Study one lesson, then run the simulator challenge.'],
      ['Port to robot', 'Apply the concept to one real subsystem.'],
      ['Debug and document', 'Record what failed and what fixed it.'],
      ['Integrate', 'Combine with previous units and test on the robot.'],
    ],
  };

  if (name === 'MotorModesDiagram') {
    return `<figure class="diagram"><figcaption>Motor Run Mode Comparison</figcaption><div class="mode-grid">
      <div><h4>RUN_WITHOUT_ENCODER</h4><p>setPower() acts like a voltage fraction. Actual speed changes with battery, load, and friction.</p></div>
      <div><h4>RUN_USING_ENCODER</h4><p>setPower() requests a speed target. Encoder feedback helps the Hub adjust output.</p></div>
      <div><h4>RUN_TO_POSITION</h4><p>Target ticks plus power tell the Hub to move toward a position and stop or hold near it.</p></div>
    </div></figure>`;
  }

  if (name === 'ImuAxesDiagram') {
    return `<figure class="diagram"><figcaption>Robot Orientation Axes</figcaption>
      <svg viewBox="0 0 720 300" role="img" aria-label="IMU yaw pitch roll axes">
        <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#39ff14"/></marker></defs>
        <rect x="250" y="110" width="220" height="92" rx="10" fill="#0d0d1e" stroke="#00bfff" stroke-width="2"/>
        <path d="M295 155 L425 155" stroke="#39ff14" stroke-width="4" marker-end="url(#arrow)"/>
        <path d="M360 195 L360 48" stroke="#39ff14" stroke-width="4" marker-end="url(#arrow)"/>
        <path d="M285 195 C210 155 210 85 285 63" fill="none" stroke="#00bfff" stroke-width="4" marker-end="url(#arrow)"/>
        <path d="M470 135 C555 135 584 189 536 237" fill="none" stroke="#00bfff" stroke-width="4" marker-end="url(#arrow)"/>
        <text x="330" y="160" fill="#e8f4ff" font-size="18">Forward</text>
        <text x="374" y="60" fill="#39ff14" font-size="18">Z axis / yaw</text>
        <text x="145" y="88" fill="#00bfff" font-size="18">Roll</text>
        <text x="555" y="232" fill="#00bfff" font-size="18">Pitch</text>
      </svg></figure>`;
  }

  if (name === 'BezierComparisonDiagram') {
    return `<figure class="diagram"><figcaption>Straight Segments vs Bezier Path</figcaption>
      <svg viewBox="0 0 760 290" role="img" aria-label="Stop turn drive path compared to Bezier path">
        <defs><marker id="cyanArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#00bfff"/></marker><marker id="greenArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#39ff14"/></marker></defs>
        <rect x="30" y="44" width="700" height="200" rx="12" fill="#0d0d1e" stroke="rgba(0,191,255,0.35)"/>
        <path d="M90 185 L260 185 L260 88 L455 88 L455 154 L650 154" fill="none" stroke="#00bfff" stroke-width="5" stroke-dasharray="10 8" marker-end="url(#cyanArrow)"/>
        <path d="M90 202 C210 110 325 225 455 106 S590 118 650 82" fill="none" stroke="#39ff14" stroke-width="6" marker-end="url(#greenArrow)"/>
        <text x="86" y="70" fill="#00bfff" font-size="18">Stop-turn-drive: simple, but slow at corners</text>
        <text x="86" y="264" fill="#39ff14" font-size="18">Bezier path: smoother target geometry for the follower</text>
      </svg></figure>`;
  }

  const title = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace('Diagram', '').trim();
  const list = nodes[name] || [];
  return `<figure class="diagram"><figcaption>${title}</figcaption><div class="flow">${list
    .map((node, index) => `<div class="node"><b>${index + 1}</b><strong>${node[0]}</strong><p>${node[1]}</p></div>`)
    .join('')}</div></figure>`;
}

function preprocess(body) {
  let text = body;
  text = text.replace(/^import .+;?\n/gm, '');
  text = text.replace(/\n## Simulator Challenge[\s\S]*?(?=\n<MarkComplete|\n# |$)/g, '');
  text = text.replace(/<MarkComplete[\s\S]*?\/>/g, '');
  text = text.replace(/<Unit\d+Simulator[\s\S]*?\/>/g, '');
  text = text.replace(/<UnitOverview[\s\S]*?\/>/g, '<div class="note">This unit overview is generated from the current Telemark curriculum data on the website.</div>');
  text = text.replace(/<([A-Za-z]+Diagram)\s*\/>/g, (_, name) => diagram(name));

  text = text.replace(/:::(\w+)([^\n]*)\n([\s\S]*?)\n:::/g, (_, type, title, content) => {
    const label = title.trim() || type;
    return `<div class="admonition ${type}"><strong>${inlineMd(label)}</strong>${markdownToHtml(content)}</div>`;
  });

  text = text.replace(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/g, (_, summary, content) => {
    return `<section class="details"><h4>${inlineMd(summary.trim())}</h4>${markdownToHtml(content.trim())}</section>`;
  });

  return text;
}

function markdownToHtml(markdown) {
  const codeBlocks = [];
  const htmlBlocks = [];
  let text = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = '', code) => {
    const token = `@@CODE_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.trimEnd())}</code></pre>`);
    return token;
  });

  text = text.replace(/((?:^\|.*\|\n?){2,})/gm, (block) => {
    const rows = block
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|') && line.endsWith('|'))
      .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
      .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
    if (rows.length < 2) return block;
    const [head, ...body] = rows;
    const html = `<table><thead><tr>${head.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')}</tr></thead><tbody>${body
      .map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
    const token = `@@HTML_${htmlBlocks.length}@@`;
    htmlBlocks.push(html);
    return token;
  });

  const lines = text.split('\n');
  const html = [];
  let paragraph = [];
  let list = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMd(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    if (line.startsWith('@@CODE_') || line.startsWith('@@HTML_')) {
      flushParagraph();
      closeList();
      html.push(line);
      continue;
    }

    if (line.startsWith('<')) {
      flushParagraph();
      closeList();
      html.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${inlineMd(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      closeList();
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (list !== 'ul') {
        closeList();
        html.push('<ul>');
        list = 'ul';
      }
      html.push(`<li>${inlineMd(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list !== 'ol') {
        closeList();
        html.push('<ol>');
        list = 'ol';
      }
      html.push(`<li>${inlineMd(ordered[1])}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();

  return html
    .join('\n')
    .replace(/@@CODE_(\d+)@@/g, (_, index) => codeBlocks[Number(index)])
    .replace(/@@HTML_(\d+)@@/g, (_, index) => htmlBlocks[Number(index)]);
}

function docToHtml(file) {
  const raw = readFileSync(path.join(root, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const title = data.title || file;
  const isOverview = /\/\d+\.0-overview\.mdx$|\/00-overview\.mdx$/.test(file);
  const cleanedBody = preprocess(body).replace(/^\s*#\s+.+\n+/, '');
  const overviewHtml = isOverview ? unitOverviewHtml(file) : null;
  return `<article class="${isOverview ? 'unit-overview' : 'lesson'}">
    <h1>${inlineMd(title)}</h1>
    ${overviewHtml || markdownToHtml(cleanedBody)}
  </article>`;
}

function extractString(block, key) {
  const match = block.match(new RegExp(`${key}:\\s*'([\\s\\S]*?)',`));
  return match ? match[1].replace(/\n\s+/g, ' ') : '';
}

function unitOverviewHtml(file) {
  const unitMatch = file.match(/unit-(\d{2})/);
  if (!unitMatch) return '';
  const id = `UNIT_${unitMatch[1]}`;
  const start = curriculumSource.indexOf(`id: '${id}'`);
  if (start === -1) return '';
  const end = curriculumSource.indexOf('\n  },', start);
  const block = curriculumSource.slice(start, end);
  const desc = extractString(block, 'desc');
  const overview = extractString(block, 'overview');
  const outcomesMatch = block.match(/outcomes:\s*\[([\s\S]*?)\]/);
  const outcomes = outcomesMatch
    ? Array.from(outcomesMatch[1].matchAll(/'([\s\S]*?)',/g)).map((item) => item[1].replace(/\n\s+/g, ' '))
    : [];
  return `
    ${desc ? `<p class="lead">${inlineMd(desc)}</p>` : ''}
    ${overview ? `<p>${inlineMd(overview)}</p>` : ''}
    ${outcomes.length ? `<h2>Learning Outcomes</h2><ul>${outcomes.map((outcome) => `<li>${inlineMd(outcome)}</li>`).join('')}</ul>` : ''}
  `;
}

const articles = docs.filter((file) => existsSync(path.join(root, file))).map(docToHtml).join('\n');
const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${config.title}</title>
<style>
@page { size: Letter; margin: 0.65in; }
* { box-sizing: border-box; }
body { margin: 0; color: #17202a; font-family: Arial, Helvetica, sans-serif; font-size: 11.5pt; line-height: 1.5; }
.cover { min-height: 9.4in; display: flex; flex-direction: column; justify-content: center; page-break-after: always; border: 2px solid #00bfff; padding: 0.6in; background: linear-gradient(135deg, #07070f, #0d0d1e); color: #e8f4ff; }
.cover h1 { font-size: 42pt; line-height: 0.95; margin: 0 0 0.25in; color: #fff; }
.cover p { font-size: 14pt; max-width: 5.8in; color: rgba(232,244,255,0.82); }
.cover .meta { margin-top: 0.3in; color: #39ff14; font-family: monospace; font-size: 11pt; }
article { page-break-before: always; }
article:first-of-type { page-break-before: auto; }
h1 { color: #0b5394; font-size: 23pt; line-height: 1.08; margin: 0 0 0.18in; }
h2 { color: #073763; font-size: 15pt; margin: 0.22in 0 0.08in; border-bottom: 1px solid #d7e7f2; padding-bottom: 0.03in; }
h3 { color: #134f5c; font-size: 12.5pt; margin: 0.18in 0 0.06in; }
h4 { margin: 0.1in 0 0.04in; }
p { margin: 0.06in 0; }
ul, ol { margin: 0.06in 0 0.1in 0.25in; padding-left: 0.18in; }
li { margin: 0.025in 0; }
code { font-family: "Courier New", monospace; background: #f3f6f8; padding: 0.02in 0.04in; border-radius: 3px; }
pre { white-space: pre-wrap; background: #ffffff; color: #111111; border: 1px solid #9eb6c4; padding: 0.14in; border-radius: 4px; font-size: 10pt; line-height: 1.42; page-break-inside: avoid; overflow-wrap: anywhere; }
pre code { display: block; background: transparent; padding: 0; border-radius: 0; }
a { color: #0b5394; text-decoration: none; }
table { width: 100%; border-collapse: collapse; margin: 0.12in 0; page-break-inside: avoid; }
th, td { border: 1px solid #c8dce8; padding: 0.06in; vertical-align: top; }
th { background: #eef7fc; color: #073763; }
.lead { font-size: 12pt; color: #34495e; }
.admonition, .note, .details { page-break-inside: avoid; border-left: 5px solid #00bfff; background: #eef7fc; padding: 0.1in 0.13in; margin: 0.12in 0; border-radius: 5px; }
.admonition.warning { border-color: #e69138; background: #fff4e5; }
.admonition.tip { border-color: #39a852; background: #edf8ef; }
.admonition.info, .note { border-color: #00bfff; background: #eef7fc; }
.details { border-color: #6aa84f; background: #f4fbf1; }
.diagram { page-break-inside: avoid; margin: 0.16in 0; padding: 0.14in; border: 1px solid #a8d8ef; border-radius: 7px; background: #f8fcff; }
.diagram figcaption { color: #0b5394; font-weight: bold; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.1in; }
.flow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.08in; }
.node, .mode-grid > div { border: 1px solid #b9d7e8; border-radius: 6px; padding: 0.08in; background: #ffffff; min-height: 0.88in; }
.node b { display: inline-block; color: #1c7f37; margin-bottom: 0.03in; }
.node strong, .mode-grid h4 { display: block; color: #073763; margin: 0 0 0.03in; font-size: 10pt; }
.node p, .mode-grid p { margin: 0; font-size: 8.8pt; color: #34495e; }
.mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.09in; }
svg { width: 100%; height: auto; }
</style>
</head>
<body>
<section class="cover">
  <h1>${config.title}</h1>
  <p>Current Telemark FTC Java curriculum export, rebuilt from the Docusaurus website lessons, simulator challenge text, official-reference notes, mentor debugging notes, learning paths, and visual diagrams.</p>
  <div class="meta">Generated ${generatedAt} from the local Telemark curriculum source.</div>
</section>
${articles}
</body>
</html>`;

mkdirSync(path.join(root, 'build'), { recursive: true });
writeFileSync(outHtml, html);
// Chrome lives in different places on Linux, macOS, and CI images. Pick the
// first one that exists, or let CHROME_PATH override it.
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

const chrome = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chrome) {
  console.error(
    `Wrote ${outHtml}, but no Chrome binary was found to render the PDF.\n`
    + 'Set CHROME_PATH to a Chrome or Chromium executable and run again.',
  );
  process.exit(1);
}

execFileSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',
  `--print-to-pdf=${outPdf}`,
  `file://${outHtml}`,
], { stdio: 'inherit' });
