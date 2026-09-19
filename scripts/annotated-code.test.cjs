const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const component = read('src/components/AnnotatedCode.tsx');

assert.match(component, /type="button"/);
assert.match(component, /aria-pressed/);
assert.match(component, /Java/);
assert.match(component, /Python/);
assert.match(component, /Compare Python/);
assert.match(component, /Concept comparison only/);
assert.match(read('src/theme/MDXComponents.tsx'), /AnnotatedCode/);

const lessonFiles = [];
for (const directory of ['docs/unit-00', 'docs/unit-13', 'docs/unit-15']) {
  for (const name of fs.readdirSync(path.join(root, directory))) {
    if (!name.endsWith('.mdx')) continue;
    const source = read(path.join(directory, name));
    if (source.includes('<AnnotatedCode')) lessonFiles.push(path.join(directory, name));
  }
}
assert.ok(lessonFiles.length >= 8, 'Java/Python comparison should appear throughout the new OOP path');
assert.ok(lessonFiles.some((file) => file.includes('unit-15')), 'final autonomous needs a conceptual Python comparison');
for (const lesson of [
  '13.1-encapsulation.mdx',
  '13.2-inheritance.mdx',
  '13.3-override.mdx',
  '13.4-static-constants.mdx',
  '13.5-robot-class.mdx',
  '13.6-build-intake.mdx',
  '13.7-build-lift.mdx',
  '13.8-build-robot-hardware.mdx',
  '13.9-competition-teleop.mdx',
]) {
  assert.match(read(path.join('docs/unit-13', lesson)), /<AnnotatedCode/, `${lesson} needs a Java/Python comparison`);
}

const resources = read('blocks/python-resources.mdx');
for (const url of ['futurecoder.io', 'codeclub.org/en/learn-to-code', 'cs50.harvard.edu/python', 'programiz.com/python-programming']) {
  assert.ok(resources.includes(url), `Python resource page is missing ${url}`);
}
assert.match(resources, /optional/i);
assert.match(resources, /FTC.*Java/i);

console.log('Accessible annotated-code toggle and Python bridge checks passed');
