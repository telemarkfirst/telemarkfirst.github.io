const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourceName = '11115_Gluten_Free_RoverRuckus_Robot_GLB.glb';
const sourcePath = path.join(repoRoot, 'robot-cad-sources', sourceName);
const modelRoot = path.join(repoRoot, 'static/simulator/models');
const partRoot = path.join(modelRoot, 'parts');
const fullOutput = path.join(modelRoot, '11115-gluten-free-rover-ruckus-telemark.glb');
const optimizerPackage = '@gltf-transform/cli@4.4.2';

const wheelNames = [
  'telemark-cad-wheel-left-front',
  'telemark-cad-wheel-left-back',
  'telemark-cad-wheel-right-front',
  'telemark-cad-wheel-right-back',
];

function align4(value) {
  return (value + 3) & ~3;
}

function readGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a binary glTF file`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  return {json, bin: Buffer.from(bytes.subarray(binHeader + 8, binHeader + 8 + binLength))};
}

function encodeGlb(json, bin) {
  const jsonSource = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.alloc(align4(jsonSource.length), 0x20);
  jsonSource.copy(paddedJson);
  const paddedBin = Buffer.alloc(align4(bin.length));
  bin.copy(paddedBin);
  const output = Buffer.alloc(12 + 8 + paddedJson.length + 8 + paddedBin.length);
  output.write('glTF', 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJson.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  paddedJson.copy(output, 20);
  const binHeader = 20 + paddedJson.length;
  output.writeUInt32LE(paddedBin.length, binHeader);
  output.writeUInt32LE(0x004e4942, binHeader + 4);
  paddedBin.copy(output, binHeader + 8);
  return output;
}

function writeGlb(file, parsed) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, encodeGlb(parsed.json, parsed.bin));
}

function descendants(json, root, output = []) {
  output.push(root);
  for (const child of json.nodes[root]?.children || []) descendants(json, child, output);
  return output;
}

function findNamed(json, name, within) {
  const candidates = within || json.nodes.map((_, index) => index);
  const found = candidates.find((index) => json.nodes[index]?.name === name);
  if (found === undefined) throw new Error(`Could not find Rover Ruckus CAD node: ${name}`);
  return found;
}

function selectedGlb(parsed, roots, excludedRoots = []) {
  const source = parsed.json;
  const excluded = new Set(excludedRoots.flatMap((root) => descendants(source, root, [])));
  const nodeIds = [];
  const nodeSet = new Set();
  function visit(index) {
    if (excluded.has(index) || nodeSet.has(index)) return;
    nodeSet.add(index);
    nodeIds.push(index);
    for (const child of source.nodes[index]?.children || []) visit(child);
  }
  roots.forEach(visit);

  const meshIds = [...new Set(nodeIds
    .map((index) => source.nodes[index].mesh)
    .filter((index) => index !== undefined))];
  const accessorIds = new Set();
  for (const meshIndex of meshIds) {
    for (const primitive of source.meshes[meshIndex].primitives || []) {
      if (primitive.indices !== undefined) accessorIds.add(primitive.indices);
      Object.values(primitive.attributes || {}).forEach((index) => accessorIds.add(index));
      for (const target of primitive.targets || []) Object.values(target).forEach((index) => accessorIds.add(index));
    }
  }
  const accessorList = [...accessorIds].sort((left, right) => left - right);
  const viewIds = new Set();
  for (const accessorIndex of accessorList) {
    const accessor = source.accessors[accessorIndex];
    if (accessor.bufferView !== undefined) viewIds.add(accessor.bufferView);
    if (accessor.sparse) {
      viewIds.add(accessor.sparse.indices.bufferView);
      viewIds.add(accessor.sparse.values.bufferView);
    }
  }
  const viewList = [...viewIds].sort((left, right) => left - right);
  const nodeMap = new Map(nodeIds.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const meshMap = new Map(meshIds.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const accessorMap = new Map(accessorList.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const viewMap = new Map(viewList.map((oldIndex, newIndex) => [oldIndex, newIndex]));

  const nodes = nodeIds.map((oldIndex) => {
    const node = structuredClone(source.nodes[oldIndex]);
    if (node.children) {
      node.children = node.children.filter((child) => nodeMap.has(child)).map((child) => nodeMap.get(child));
      if (!node.children.length) delete node.children;
    }
    if (node.mesh !== undefined) node.mesh = meshMap.get(node.mesh);
    delete node.extensions;
    return node;
  });
  const meshes = meshIds.map((oldIndex) => {
    const mesh = structuredClone(source.meshes[oldIndex]);
    for (const primitive of mesh.primitives || []) {
      if (primitive.indices !== undefined) primitive.indices = accessorMap.get(primitive.indices);
      for (const semantic of Object.keys(primitive.attributes || {})) {
        primitive.attributes[semantic] = accessorMap.get(primitive.attributes[semantic]);
      }
      for (const target of primitive.targets || []) {
        for (const semantic of Object.keys(target)) target[semantic] = accessorMap.get(target[semantic]);
      }
      delete primitive.extensions;
    }
    delete mesh.extensions;
    return mesh;
  });
  const accessors = accessorList.map((oldIndex) => {
    const accessor = structuredClone(source.accessors[oldIndex]);
    if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = viewMap.get(accessor.sparse.indices.bufferView);
      accessor.sparse.values.bufferView = viewMap.get(accessor.sparse.values.bufferView);
    }
    return accessor;
  });

  const binParts = [];
  const bufferViews = [];
  let byteLength = 0;
  for (const oldIndex of viewList) {
    const sourceView = source.bufferViews[oldIndex];
    const offset = align4(byteLength);
    if (offset > byteLength) binParts.push(Buffer.alloc(offset - byteLength));
    binParts.push(Buffer.from(parsed.bin.subarray(
      sourceView.byteOffset || 0,
      (sourceView.byteOffset || 0) + sourceView.byteLength,
    )));
    bufferViews.push({...sourceView, buffer: 0, byteOffset: offset});
    byteLength = offset + sourceView.byteLength;
  }
  const bin = Buffer.concat(binParts);
  return {
    json: {
      asset: {generator: 'Telemark Team 11115 Rover Ruckus CAD partitioner', version: '2.0'},
      scene: 0,
      scenes: [{nodes: roots.filter((root) => nodeMap.has(root)).map((root) => nodeMap.get(root))}],
      nodes,
      meshes,
      accessors,
      bufferViews,
      buffers: [{byteLength: bin.length}],
      materials: structuredClone(source.materials || []),
    },
    bin,
  };
}

function run(command, args) {
  const result = spawnSync(command, args, {cwd: repoRoot, encoding: 'utf8', stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function wrapComponent(file, name, extras = {}) {
  const parsed = readGlb(file);
  const scene = parsed.json.scenes[parsed.json.scene || 0];
  const wrapperIndex = parsed.json.nodes.push({
    name,
    children: scene.nodes,
    extras: {telemarkCadGroup: name, ...extras},
  }) - 1;
  scene.nodes = [wrapperIndex];
  writeGlb(file, parsed);
}

function optimizeComponent(parsed, roots, excluded, target, name, extras, settings = {}) {
  const staged = `${target}.source.glb`;
  writeGlb(staged, selectedGlb(parsed, roots, excluded));
  run('npx', [
    '--yes', optimizerPackage, 'optimize', staged, target,
    '--compress', 'quantize',
    '--flatten', 'true',
    '--join', 'true',
    '--instance', 'false',
    '--simplify-ratio', String(settings.ratio ?? 0.1),
    '--simplify-error', String(settings.error ?? 0.015),
  ]);
  fs.unlinkSync(staged);
  wrapComponent(target, name, extras);
}

function merge(files, target) {
  run('npx', ['--yes', optimizerPackage, 'merge', ...files, target, '--merge-scenes', 'true']);
}

function decorate(file, options = {}) {
  const parsed = readGlb(file);
  const provenance = {
    telemarkSourceModel: sourceName,
    telemarkCadTeam: 'FTC 11115 Gluten Free',
    telemarkCadSeason: '2018-19 Rover Ruckus',
    telemarkExtracted: Boolean(options.partType),
  };
  parsed.json.asset = {
    ...(parsed.json.asset || {}),
    copyright: "FTC Team 11115 Gluten Free. Used with the team's explicit permission.",
    extras: {...(parsed.json.asset?.extras || {}), ...provenance},
  };
  parsed.json.extras = {...(parsed.json.extras || {}), ...provenance};
  const scene = parsed.json.scenes[parsed.json.scene || 0];
  scene.extras = {...(scene.extras || {}), ...provenance};
  if (options.partType) {
    const partMetadata = {telemarkPartType: options.partType};
    Object.assign(parsed.json.asset.extras, partMetadata);
    Object.assign(parsed.json.extras, partMetadata);
    Object.assign(scene.extras, partMetadata);
    for (const rootIndex of scene.nodes || []) {
      const root = parsed.json.nodes[rootIndex];
      root.extras = {...(root.extras || {}), ...partMetadata};
    }
  }
  writeGlb(file, parsed);
}

function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source CAD: ${sourcePath}`);
  fs.mkdirSync(modelRoot, {recursive: true});
  fs.mkdirSync(partRoot, {recursive: true});
  const parsed = readGlb(sourcePath);
  const sceneRoot = parsed.json.scenes[parsed.json.scene || 0].nodes[0];
  const topLevel = parsed.json.nodes[sceneRoot].children || [];
  const top = (name) => findNamed(parsed.json, name, topLevel);

  const battery = top('Battery Mount v34 <1>');
  const powerSwitch = top('Power Switch Mount v14 <1>');
  const phone = top('Phone Mount v3 <1>');
  const hang = top('Hang Assembly v28 <1>');
  const intake = top('Full Intake Assembly v100 <1>');
  const feeder = top('Feeder v52 <1>');
  const drivetrain = top('Drivetrain Assembly v80 <1>');
  const drivetrainNodes = descendants(parsed.json, drivetrain, []);
  const wheels = [
    ['telemark-cad-wheel-left-front', findNamed(parsed.json, 'Wheel Assembly v7(Mirror) <2>', drivetrainNodes), 'left-front'],
    ['telemark-cad-wheel-left-back', findNamed(parsed.json, 'Wheel Assembly v10-1 <1>', drivetrainNodes), 'left-back'],
    ['telemark-cad-wheel-right-front', findNamed(parsed.json, 'Wheel Assembly v10 <1>', drivetrainNodes), 'right-front'],
    ['telemark-cad-wheel-right-back', findNamed(parsed.json, 'Wheel Assembly v7(Mirror) <1>', drivetrainNodes), 'right-back'],
  ];

  const intakeNodes = descendants(parsed.json, intake, []);
  const intakeRollers = [
    findNamed(parsed.json, 'occurrence of Print Roller v22', [1305]),
    findNamed(parsed.json, 'occurrence of Print Roller v22', [1411]),
  ];
  const feederChildren = parsed.json.nodes[feeder].children || [];
  const feederStageRoots = [
    findNamed(parsed.json, 'Moving Stage v41 <1>', feederChildren),
    findNamed(parsed.json, 'Moving Stage v41-2 <1>', feederChildren),
    findNamed(parsed.json, 'Moving Stage v41-1 <1>', feederChildren),
  ];
  const feederCarriageRoots = [
    findNamed(parsed.json, 'Caridge v26 <1>', feederChildren),
    findNamed(parsed.json, 'Dumper v101 <1>', feederChildren),
  ];

  // Guard against source-export changes before doing expensive optimization.
  if (!intakeNodes.includes(intakeRollers[0]) || !intakeNodes.includes(intakeRollers[1])) {
    throw new Error('The Rover Ruckus intake roller roots moved in the source hierarchy.');
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'telemark-11115-rover-'));
  try {
    const components = {};
    function component(key, roots, excluded, name, extras, settings) {
      const file = path.join(temporaryRoot, `${key}.glb`);
      optimizeComponent(parsed, roots, excluded, file, name, extras, settings);
      components[key] = file;
      return file;
    }

    component(
      'chassis',
      [battery, powerSwitch, phone, drivetrain],
      wheels.map((entry) => entry[1]),
      'telemark-cad-chassis',
      {telemarkCadRole: 'chassis'},
      {ratio: 0.02, error: 0.03},
    );
    wheels.forEach(([name, root, identity], index) => component(
      `wheel-${index}`,
      [root],
      [],
      name,
      {telemarkCadWheel: identity, spinAxis: 'z', telemarkCadAxis: 'auto', telemarkCadContinuous: true},
      {ratio: 0.08, error: 0.02},
    ));
    component('hang', [hang], [], 'telemark-cad-rover-hang', {telemarkCadRole: 'hang'}, {ratio: 0.015, error: 0.03});
    component(
      'intake-static',
      [intake],
      intakeRollers,
      'telemark-cad-rover-intake-static',
      {telemarkCadRole: 'intake-static'},
      {ratio: 0.055, error: 0.02},
    );
    intakeRollers.forEach((root, index) => component(
      `intake-roller-${index + 1}`,
      [root],
      [],
      `telemark-cad-intake-stage-${index + 1}`,
      {telemarkCadAxis: 'x', telemarkCadContinuous: true, telemarkCadMotion: 'spin'},
      {ratio: 0.3, error: 0.006},
    ));
    component(
      'lift-static',
      [feeder],
      [...feederStageRoots, ...feederCarriageRoots],
      'telemark-cad-rover-lift-static',
      {telemarkCadRole: 'lift-static'},
      {ratio: 0.07, error: 0.018},
    );
    const liftTravel = [0.085, 0.17, 0.255];
    feederStageRoots.forEach((root, index) => component(
      `lift-stage-${index + 1}`,
      [root],
      [],
      `telemark-cad-rover-lift-stage-${index + 1}`,
      {telemarkCadAxis: 'z', telemarkCadMin: 0, telemarkCadMax: liftTravel[index]},
      {ratio: 0.12, error: 0.01},
    ));
    component(
      'lift-carriage',
      feederCarriageRoots,
      [],
      'telemark-cad-rover-lift-carriage',
      {telemarkCadAxis: 'z', telemarkCadMin: 0, telemarkCadMax: 0.34},
      {ratio: 0.12, error: 0.01},
    );

    const drivetrainFiles = ['chassis', 'wheel-0', 'wheel-1', 'wheel-2', 'wheel-3'].map((key) => components[key]);
    const intakeFiles = ['intake-static', 'intake-roller-1', 'intake-roller-2'].map((key) => components[key]);
    const liftFiles = ['lift-static', 'lift-stage-1', 'lift-stage-2', 'lift-stage-3', 'lift-carriage'].map((key) => components[key]);

    const drivetrainOutput = path.join(partRoot, 'roverruckus-drivetrain.glb');
    const intakeOutput = path.join(partRoot, 'roverruckus-intake.glb');
    const liftOutput = path.join(partRoot, 'roverruckus-lift.glb');
    const hangOutput = path.join(partRoot, 'roverruckus-hang.glb');
    merge(drivetrainFiles, drivetrainOutput);
    merge(intakeFiles, intakeOutput);
    merge(liftFiles, liftOutput);
    fs.copyFileSync(components.hang, hangOutput);
    decorate(drivetrainOutput, {partType: 'drivetrain'});
    decorate(intakeOutput, {partType: 'intake'});
    decorate(liftOutput, {partType: 'telescoping-lift'});
    decorate(hangOutput, {partType: 'hang'});

    merge(Object.values(components), fullOutput);
    decorate(fullOutput);
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }

  for (const file of [
    fullOutput,
    path.join(partRoot, 'roverruckus-drivetrain.glb'),
    path.join(partRoot, 'roverruckus-intake.glb'),
    path.join(partRoot, 'roverruckus-lift.glb'),
    path.join(partRoot, 'roverruckus-hang.glb'),
  ]) {
    console.log(`${path.relative(repoRoot, file)}: ${Math.round(fs.statSync(file).size / 1024)} KiB`);
  }
}

main();
