const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(
  repoRoot,
  'robot-cad-sources/11115_Gluten_Free_Skystone_Robot_GLB.glb',
);
const outputPath = path.join(
  repoRoot,
  'static/simulator/models/11115-gluten-free-skystone-telemark.glb',
);

function align4(value) {
  return (value + 3) & ~3;
}

function readGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${file} is not a binary glTF file`);
  }
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  return {
    json,
    bin: Buffer.from(bytes.subarray(binHeader + 8, binHeader + 8 + binLength)),
  };
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

function findNamed(json, name, within) {
  const candidates = within || json.nodes.map((_, index) => index);
  const found = candidates.find((index) => json.nodes[index]?.name === name);
  if (found === undefined) throw new Error(`Could not find CAD node: ${name}`);
  return found;
}

function descendants(json, root, output = []) {
  output.push(root);
  for (const child of json.nodes[root]?.children || []) descendants(json, child, output);
  return output;
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
      for (const target of primitive.targets || []) {
        Object.values(target).forEach((index) => accessorIds.add(index));
      }
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
  const json = {
    asset: {generator: 'Telemark 11115 CAD partitioner', version: '2.0'},
    scene: 0,
    scenes: [{nodes: roots.filter((root) => nodeMap.has(root)).map((root) => nodeMap.get(root))}],
    nodes,
    meshes,
    accessors,
    bufferViews,
    buffers: [{byteLength: bin.length}],
    materials: structuredClone(source.materials || []),
  };
  return {json, bin};
}

function run(command, args) {
  const result = spawnSync(command, args, {cwd: repoRoot, encoding: 'utf8', stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function wrapOptimizedPart(file, name, extras) {
  const parsed = readGlb(file);
  const scene = parsed.json.scenes[parsed.json.scene || 0];
  const groupIndex = parsed.json.nodes.push({
    name,
    children: scene.nodes,
    extras: {telemarkCadGroup: name, ...(extras || {})},
  }) - 1;
  scene.nodes = [groupIndex];
  fs.writeFileSync(file, encodeGlb(parsed.json, parsed.bin));
}

function main() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source CAD: ${sourcePath}`);
  const parsed = readGlb(sourcePath);
  const rootChildren = parsed.json.nodes[parsed.json.scenes[parsed.json.scene || 0].nodes[0]].children;
  const top = (name) => findNamed(parsed.json, name, rootChildren);
  const drivetrain = top('Drivetrain Assembly v200 <1>');
  const drivetrainChildren = descendants(parsed.json, drivetrain, []);
  const wheelRoots = [
    findNamed(parsed.json, 'Left Wheel Assembly v59 (1) <1>', drivetrainChildren),
    findNamed(parsed.json, 'Right Wheel Assembly v4 (1) <1>', drivetrainChildren),
    findNamed(parsed.json, 'Left Wheel Assembly v59 <1>', drivetrainChildren),
    findNamed(parsed.json, 'Right Wheel Assembly v4 <1>', drivetrainChildren),
  ];
  const dr4b = top('OLD 177 DR4B v8 <1>');
  const dr4bChildren = parsed.json.nodes[dr4b].children || [];
  const direct = (name) => findNamed(parsed.json, name, dr4bChildren);
  const movingBarRoots = [
    direct('occurrence of Bar (3)'),
    direct('occurrence of Bar (3)(Mirror)'),
    direct('occurrence of Bar (2)'),
    direct('occurrence of Bar (2)(Mirror)'),
    direct('occurrence of Bar (1)'),
    direct('occurrence of Bar (1)(Mirror)'),
    direct('occurrence of Bar'),
    direct('occurrence of Bar(Mirror)'),
  ];
  const middlePattern = /^(?:occurrence of (?:Top Cross Beam|REV Bar|Plate|Vertical Beam)|DR4B Stage Gear)/;
  const middleRoots = dr4bChildren.filter((index) => middlePattern.test(parsed.json.nodes[index].name || ''));
  const basePattern = /^occurrence of (?:Gearbox Plate|Motor Linkage|Drive Linkage)/;
  const baseRoots = dr4bChildren.filter((index) => basePattern.test(parsed.json.nodes[index].name || ''));

  const chassisRoots = [
    top('Bottom Plate v17 <1>'),
    top('Phone Mount v8 <1>'),
    top('Middle Wheel Assembly v13 <1>'),
    top('Intake Assembly v59 <1>'),
    top('Drive v42 <1>'),
    drivetrain,
  ];
  const jobs = [
    {
      name: 'telemark-cad-chassis',
      roots: chassisRoots,
      excluded: wheelRoots,
      ratio: 0.035,
      error: 0.035,
    },
    {
      name: 'telemark-cad-wheel-left-front', roots: [wheelRoots[0]], ratio: 0.08, error: 0.025,
      center: [0.1731, 0.0412, 0.2049], spinAxis: 'z',
    },
    {
      name: 'telemark-cad-wheel-left-back', roots: [wheelRoots[1]], ratio: 0.08, error: 0.025,
      center: [-0.1508, 0.0412, 0.2049], spinAxis: 'z',
    },
    {
      name: 'telemark-cad-wheel-right-back', roots: [wheelRoots[2]], ratio: 0.08, error: 0.025,
      center: [-0.1540, -0.2985, 0.2049], spinAxis: 'z',
    },
    {
      name: 'telemark-cad-wheel-right-front', roots: [wheelRoots[3]], ratio: 0.08, error: 0.025,
      center: [0.1698, -0.2985, 0.2049], spinAxis: 'z',
    },
    {
      name: 'telemark-cad-lift-lower-low', roots: movingBarRoots.slice(0, 2), ratio: 0.35, error: 0.01,
      pivot: [-0.2, -0.129, 0.24],
    },
    {
      name: 'telemark-cad-lift-lower-high', roots: movingBarRoots.slice(2, 4), ratio: 0.35, error: 0.01,
      pivot: [-0.2, -0.129, 0.297],
    },
    {
      name: 'telemark-cad-lift-upper-low', roots: movingBarRoots.slice(4, 6), ratio: 0.35, error: 0.01,
      pivot: [0.218, -0.129, 0.278],
    },
    {
      name: 'telemark-cad-lift-upper-high', roots: movingBarRoots.slice(6, 8), ratio: 0.35, error: 0.01,
      pivot: [0.221, -0.129, 0.334],
    },
    {name: 'telemark-cad-lift-middle', roots: middleRoots, ratio: 0.12, error: 0.02},
    {name: 'telemark-cad-lift-base', roots: baseRoots, ratio: 0.18, error: 0.02},
    {
      name: 'telemark-cad-lift-carriage',
      roots: [top('Full V4B Assembly v101 <1>'), top('Even newer grabbers v25 <1>')],
      ratio: 0.05,
      error: 0.03,
    },
  ];

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'telemark-11115-'));
  const outputs = [];
  try {
    for (const [index, job] of jobs.entries()) {
      const staged = path.join(temporaryRoot, `${index}-source.glb`);
      const optimized = path.join(temporaryRoot, `${index}-optimized.glb`);
      const subset = selectedGlb(parsed, job.roots, job.excluded || []);
      fs.writeFileSync(staged, encodeGlb(subset.json, subset.bin));
      run('npx', [
        '--yes', '@gltf-transform/cli@4.4.2', 'optimize', staged, optimized,
        '--compress', 'quantize',
        '--flatten', 'true',
        '--join', 'true',
        '--instance', 'false',
        '--simplify-ratio', String(job.ratio),
        '--simplify-error', String(job.error),
      ]);
      wrapOptimizedPart(optimized, job.name, {
        ...(job.center ? {telemarkCadCenter: job.center} : {}),
        ...(job.spinAxis ? {spinAxis: job.spinAxis} : {}),
        ...(job.pivot ? {telemarkCadPivot: job.pivot} : {}),
      });
      outputs.push(optimized);
      fs.unlinkSync(staged);
    }
    const merged = path.join(temporaryRoot, '11115-merged.glb');
    run('npx', [
      '--yes', '@gltf-transform/cli@4.4.2', 'merge', ...outputs, merged, '--merge-scenes', 'true',
    ]);
    const final = readGlb(merged);
    final.json.asset = {
      ...final.json.asset,
      copyright: 'FTC Team 11115 Gluten Free. Used with the team\'s explicit permission.',
      extras: {
        title: 'FTC 11115 Gluten Free — SKYSTONE Robot',
        modification: 'Partitioned into an articulated DR4B linkage and optimized for educational real-time rendering.',
        motionReference: 'https://www.youtube.com/watch?v=i2g_b54MEFI',
      },
    };
    final.json.extras = {
      telemarkCadChassis: true,
      telemarkCadWheels: [
        'left-front', 'left-back', 'right-front', 'right-back',
      ],
      telemarkCadLift: 'double-reverse four-bar',
    };
    fs.writeFileSync(outputPath, encodeGlb(final.json, final.bin));
    console.log(`${path.relative(repoRoot, outputPath)}: ${Math.round(fs.statSync(outputPath).size / 1024)} KiB`);
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
}

main();
