const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const modelRoot = path.join(repoRoot, 'static/simulator/models');
const sourceRoot = path.join(repoRoot, 'robot-cad-sources');
const outputRoot = path.join(modelRoot, 'parts');
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

function writeGlb(file, parsed) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(parsed.json, parsed.bin));
  fs.renameSync(temporary, file);
}

function descendants(json, root, output = []) {
  output.push(root);
  for (const child of json.nodes[root]?.children || []) descendants(json, child, output);
  return output;
}

function findNamed(json, name, within) {
  const candidates = within || json.nodes.map((_, index) => index);
  const found = candidates.find((index) => json.nodes[index]?.name === name);
  if (found === undefined) throw new Error(`Could not find CAD node: ${name}`);
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
  for (const image of source.images || []) {
    if (image.bufferView !== undefined) viewIds.add(image.bufferView);
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
  const images = (source.images || []).map((image) => {
    const result = structuredClone(image);
    if (result.bufferView !== undefined) result.bufferView = viewMap.get(result.bufferView);
    return result;
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
  const extensionAllowlist = new Set([
    'KHR_materials_clearcoat',
    'KHR_materials_emissive_strength',
    'KHR_materials_ior',
    'KHR_materials_specular',
    'KHR_materials_transmission',
    'KHR_materials_unlit',
    'KHR_materials_variants',
    'KHR_materials_volume',
    'KHR_mesh_quantization',
    'KHR_texture_transform',
    'KHR_texture_basisu',
  ]);
  const extensionsUsed = (source.extensionsUsed || []).filter((name) => extensionAllowlist.has(name));
  const extensionsRequired = (source.extensionsRequired || []).filter((name) => extensionAllowlist.has(name));
  const json = {
    asset: {
      ...(structuredClone(source.asset || {})),
      generator: 'Telemark deterministic CAD part extractor',
      version: '2.0',
    },
    scene: 0,
    scenes: [{nodes: roots.filter((root) => nodeMap.has(root)).map((root) => nodeMap.get(root))}],
    nodes,
    meshes,
    accessors,
    bufferViews,
    buffers: [{byteLength: bin.length}],
    materials: structuredClone(source.materials || []),
  };
  if (images.length) json.images = images;
  if (source.textures?.length) json.textures = structuredClone(source.textures);
  if (source.samplers?.length) json.samplers = structuredClone(source.samplers);
  if (extensionsUsed.length) json.extensionsUsed = extensionsUsed;
  if (extensionsRequired.length) json.extensionsRequired = extensionsRequired;
  return {json, bin};
}

function run(command, args) {
  const result = spawnSync(command, args, {cwd: repoRoot, encoding: 'utf8', stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function optimizeSubset(parsed, roots, excluded, target, settings = {}) {
  const staged = `${target}.source.glb`;
  writeGlb(staged, selectedGlb(parsed, roots, excluded));
  run('npx', [
    '--yes', optimizerPackage, 'optimize', staged, target,
    '--compress', 'quantize',
    '--flatten', 'true',
    '--join', 'true',
    '--instance', 'false',
    '--simplify-ratio', String(settings.ratio ?? 0.2),
    '--simplify-error', String(settings.error ?? 0.015),
  ]);
  fs.unlinkSync(staged);
}

/**
 * Keep the source assembly hierarchy for mechanisms whose motion depends on
 * individual links. Flattening or joining bakes the whole scissor slide into
 * one mesh and leaves the runtime with no choice but to translate it intact.
 */
function optimizeArticulatedSubset(parsed, roots, target, settings = {}) {
  const staged = `${target}.source.glb`;
  const optimized = `${target}.optimized.glb`;
  writeGlb(staged, selectedGlb(parsed, roots));
  run('npx', [
    '--yes', optimizerPackage, 'optimize', staged, optimized,
    '--compress', 'quantize',
    '--flatten', 'false',
    '--join', 'false',
    '--instance', 'false',
    '--simplify-ratio', String(settings.ratio ?? 0.1),
    '--simplify-error', String(settings.error ?? 0.02),
    '--palette', 'false',
    '--texture-compress', 'false',
  ]);
  fs.renameSync(optimized, target);
  fs.unlinkSync(staged);
}

function wrapPart(file, name, extras) {
  const parsed = readGlb(file);
  const scene = parsed.json.scenes[parsed.json.scene || 0];
  const wrapperIndex = parsed.json.nodes.push({
    name,
    children: scene.nodes,
    extras: {telemarkPartType: extras.telemarkPartType, ...extras},
  }) - 1;
  scene.nodes = [wrapperIndex];
  writeGlb(file, parsed);
}

function decorate(file, partType, sourceName, nodeExtras = {}) {
  const parsed = readGlb(file);
  const scene = parsed.json.scenes[parsed.json.scene || 0];
  const metadata = {
    telemarkPartType: partType,
    telemarkSourceModel: sourceName,
    telemarkExtracted: true,
  };
  parsed.json.asset = {
    ...(parsed.json.asset || {}),
    generator: 'Telemark deterministic CAD part extractor',
    extras: {...(parsed.json.asset?.extras || {}), ...metadata},
  };
  parsed.json.extras = {...(parsed.json.extras || {}), ...metadata};
  scene.extras = {...(scene.extras || {}), ...metadata};
  for (const rootIndex of scene.nodes || []) {
    const root = parsed.json.nodes[rootIndex];
    root.extras = {...(root.extras || {}), telemarkPartType: partType};
  }
  for (const [name, extras] of Object.entries(nodeExtras)) {
    const node = parsed.json.nodes.find((candidate) => candidate.name === name);
    if (!node) throw new Error(`${path.basename(file)} is missing expected part node ${name}`);
    node.extras = {...(node.extras || {}), telemarkPartType: partType, ...extras};
  }
  writeGlb(file, parsed);
}

function writePreparedPart(sourceName, outputName, partType, nodeNames, nodeExtras = {}) {
  const sourceFile = path.join(modelRoot, sourceName);
  const parsed = readGlb(sourceFile);
  const roots = nodeNames.map((name) => findNamed(parsed.json, name));
  const outputFile = path.join(outputRoot, outputName);
  writeGlb(outputFile, selectedGlb(parsed, roots));
  const repackedFile = `${outputFile}.repacked.glb`;
  run('npx', [
    '--yes', optimizerPackage, 'optimize', outputFile, repackedFile,
    '--compress', 'quantize',
    '--flatten', 'false',
    '--join', 'false',
    '--instance', 'false',
    '--simplify', 'false',
    '--palette', 'false',
    '--texture-compress', 'false',
  ]);
  fs.renameSync(repackedFile, outputFile);
  decorate(outputFile, partType, sourceName, nodeExtras);
}

function drivetrain(sourceName, outputName) {
  const extras = Object.fromEntries(wheelNames.map((name) => [name, {
    telemarkCadAxis: 'auto',
    telemarkCadContinuous: true,
  }]));
  writePreparedPart(
    sourceName,
    outputName,
    'drivetrain',
    ['telemark-cad-chassis', ...wheelNames],
    extras,
  );
}

function buildPreparedParts() {
  drivetrain('30450-decode-robot-telemark.glb', 'decode-drivetrain.glb');
  drivetrain('quixilver-8404-itd-telemark.glb', 'quixilver-drivetrain.glb');
  drivetrain('2025-ftc-robot-manning-telemark.glb', 'manning-2025-drivetrain.glb');
  drivetrain('2024-centerstage-manning-telemark.glb', 'centerstage-drivetrain.glb');
  drivetrain('ftc17438-inputoutput-telemark.glb', 'inputoutput-drivetrain.glb');
  drivetrain('11115-gluten-free-skystone-telemark.glb', 'skystone-drivetrain.glb');

  writePreparedPart(
    '30450-decode-robot-telemark.glb',
    'decode-intake.glb',
    'intake',
    ['telemark-cad-intake-plate', 'telemark-cad-intake-stage-1', 'telemark-cad-intake-stage-2', 'telemark-cad-intake-stage-3'],
    Object.fromEntries([1, 2, 3].map((stage) => [`telemark-cad-intake-stage-${stage}`, {
      telemarkCadAxis: 'x',
      telemarkCadContinuous: true,
    }])),
  );
  writePreparedPart(
    '30450-decode-robot-telemark.glb',
    'decode-transfer.glb',
    'transfer',
    ['telemark-cad-transfer'],
    {'telemark-cad-transfer': {telemarkCadAxis: 'z', telemarkCadContinuous: true}},
  );
  writePreparedPart(
    '30450-decode-robot-telemark.glb',
    'decode-flywheel.glb',
    'flywheel',
    ['telemark-cad-flywheel'],
    {'telemark-cad-flywheel': {telemarkCadAxis: 'x', telemarkCadContinuous: true}},
  );
  writePreparedPart(
    '30450-decode-robot-telemark.glb',
    'decode-trigger.glb',
    'trigger',
    ['telemark-cad-trigger'],
    {'telemark-cad-trigger': {telemarkCadAxis: 'x', telemarkCadMin: 0, telemarkCadMax: 0.85}},
  );
  writePreparedPart(
    '2024-centerstage-manning-telemark.glb',
    'centerstage-intake.glb',
    'intake',
    ['telemark-cad-mechanism'],
    {'telemark-cad-mechanism': {
      telemarkCadAxis: 'z',
      telemarkCadMin: 0,
      telemarkCadMax: 2,
      telemarkCadPivotFractions: [0.46, 0.505, 0.5],
    }},
  );
  writePreparedPart(
    'ftc17438-inputoutput-telemark.glb',
    'inputoutput-arm.glb',
    'arm',
    ['telemark-cad-mechanism'],
    {'telemark-cad-mechanism': {
      telemarkCadAxis: 'x',
      telemarkCadMin: -0.65,
      telemarkCadMax: 0,
      telemarkCadPivotFractions: [0.5, 0.455, 0.356],
      telemarkCadPivot: [0.008606219672231241, 0.4031775471515762, 0.16948258976222357],
    }},
  );

  const liftNodes = [
    'telemark-cad-lift-lower-low',
    'telemark-cad-lift-lower-high',
    'telemark-cad-lift-upper-low',
    'telemark-cad-lift-upper-high',
    'telemark-cad-lift-middle',
    'telemark-cad-lift-base',
    'telemark-cad-lift-carriage',
  ];
  writePreparedPart(
    '11115-gluten-free-skystone-telemark.glb',
    'skystone-lift.glb',
    'lift',
    liftNodes,
    {
      'telemark-cad-lift-lower-low': {telemarkCadAxis: 'y', telemarkCadMin: -0.998, telemarkCadMax: 0},
      'telemark-cad-lift-lower-high': {telemarkCadAxis: 'y', telemarkCadMin: -0.998, telemarkCadMax: 0},
      'telemark-cad-lift-upper-low': {telemarkCadAxis: 'y', telemarkCadMin: 0, telemarkCadMax: 0.998},
      'telemark-cad-lift-upper-high': {telemarkCadAxis: 'y', telemarkCadMin: 0, telemarkCadMax: 0.998},
      'telemark-cad-lift-middle': {telemarkCadAxis: 'xz', telemarkCadMin: 0, telemarkCadMax: 1},
      'telemark-cad-lift-carriage': {telemarkCadAxis: 'xz', telemarkCadMin: 0, telemarkCadMax: 1},
    },
  );
}

function buildQuixilverParts() {
  const sourceName = 'Quilxilver-full-robot-8404.glb';
  const sourceFile = path.join(sourceRoot, sourceName);
  const parsed = readGlb(sourceFile);
  const clawRoot = findNamed(parsed.json, 'Claw Assembly <1>');
  const clawChildren = parsed.json.nodes[clawRoot].children || [];
  const leftFinger = findNamed(
    parsed.json,
    'occurrence of Pivoting Intake Claw Piece Non Driven v2.STEP<1>',
    clawChildren,
  );
  const rightFinger = findNamed(parsed.json, 'occurrence of Pivoting Intake Claw Piece', clawChildren);
  const sample = findNamed(parsed.json, 'occurrence of am-5401 Sample.step', clawChildren);
  const staticClawRoots = clawChildren.filter((index) => ![leftFinger, rightFinger, sample].includes(index));
  const armRoot = findNamed(parsed.json, 'Arm Subassembly <1>');
  const slideRoots = [
    findNamed(parsed.json, 'Horizontal Slides Linkage Assembly Mirrored <1>'),
    findNamed(parsed.json, 'Horizontal Slides Linkage Assembly <1>'),
  ];
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'telemark-cad-parts-'));
  try {
    const staticFile = path.join(temporaryRoot, 'claw-static.glb');
    const leftFile = path.join(temporaryRoot, 'claw-left.glb');
    const rightFile = path.join(temporaryRoot, 'claw-right.glb');
    const armFile = path.join(temporaryRoot, 'arm.glb');
    const slideFile = path.join(temporaryRoot, 'slide.glb');
    optimizeSubset(parsed, staticClawRoots, [], staticFile, {ratio: 0.18, error: 0.018});
    optimizeSubset(parsed, [leftFinger], [], leftFile, {ratio: 0.38, error: 0.008});
    optimizeSubset(parsed, [rightFinger], [], rightFile, {ratio: 0.38, error: 0.008});
    optimizeSubset(parsed, [armRoot], [], armFile, {ratio: 0.14, error: 0.014});
    optimizeArticulatedSubset(parsed, slideRoots, slideFile, {ratio: 0.08, error: 0.025});

    const clawPivot = [0.5377243883, -0.1319776927, 0.0229012765];
    wrapPart(staticFile, 'telemark-cad-claw-static', {telemarkPartType: 'claw'});
    wrapPart(leftFile, 'telemark-cad-claw-left', {
      telemarkPartType: 'claw',
      telemarkCadAxis: 'x',
      telemarkCadMin: 0,
      telemarkCadMax: 0.42,
      telemarkCadOpen: 0.42,
      telemarkCadClosed: 0,
      telemarkCadPivot: clawPivot,
    });
    wrapPart(rightFile, 'telemark-cad-claw-right', {
      telemarkPartType: 'claw',
      telemarkCadAxis: 'x',
      telemarkCadMin: -0.42,
      telemarkCadMax: 0,
      telemarkCadOpen: -0.42,
      telemarkCadClosed: 0,
      telemarkCadPivot: clawPivot,
    });
    const armPivot = [0.5542070206, -0.1263303608, -0.0374611319];
    wrapPart(armFile, 'telemark-cad-arm', {
      telemarkPartType: 'arm',
      telemarkCadAxis: 'z',
      telemarkCadMin: -0.65,
      telemarkCadMax: 0.65,
      telemarkCadPivot: armPivot,
    });
    wrapPart(slideFile, 'telemark-cad-mechanism', {
      telemarkPartType: 'linear-slide',
      telemarkCadAxis: 'x',
      telemarkCadMin: 0,
      // Three scissor bays can add about 290 mm before the links approach
      // their straight-line singularity. Stopping short keeps a real joint
      // angle and avoids the impossible over-extension shown by the old rig.
      telemarkCadMax: 0.29,
      telemarkCadMotion: 'scissor',
    });

    const clawOutput = path.join(outputRoot, 'quixilver-claw.glb');
    run('npx', [
      '--yes', optimizerPackage, 'merge', staticFile, leftFile, rightFile, clawOutput,
      '--merge-scenes', 'true',
    ]);
    decorate(clawOutput, 'claw', sourceName, {
      'telemark-cad-claw-left': {
        telemarkCadAxis: 'x', telemarkCadMin: 0, telemarkCadMax: 0.42,
        telemarkCadOpen: 0.42, telemarkCadClosed: 0, telemarkCadPivot: clawPivot,
      },
      'telemark-cad-claw-right': {
        telemarkCadAxis: 'x', telemarkCadMin: -0.42, telemarkCadMax: 0,
        telemarkCadOpen: -0.42, telemarkCadClosed: 0, telemarkCadPivot: clawPivot,
      },
    });

    const armOutput = path.join(outputRoot, 'quixilver-arm.glb');
    fs.copyFileSync(armFile, armOutput);
    decorate(armOutput, 'arm', sourceName, {
      'telemark-cad-arm': {
        telemarkCadAxis: 'z', telemarkCadMin: -0.65, telemarkCadMax: 0.65, telemarkCadPivot: armPivot,
      },
    });

    const slideOutput = path.join(outputRoot, 'quixilver-slide.glb');
    fs.copyFileSync(slideFile, slideOutput);
    decorate(slideOutput, 'linear-slide', sourceName, {
      'telemark-cad-mechanism': {
        telemarkCadAxis: 'x', telemarkCadMin: 0, telemarkCadMax: 0.29,
        telemarkCadMotion: 'scissor',
      },
    });
  } finally {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
  }
}

function main() {
  fs.mkdirSync(outputRoot, {recursive: true});
  buildPreparedParts();
  buildQuixilverParts();
  for (const file of fs.readdirSync(outputRoot).filter((name) => name.endsWith('.glb')).sort()) {
    const size = Math.round(fs.statSync(path.join(outputRoot, file)).size / 1024);
    console.log(`${path.relative(repoRoot, path.join(outputRoot, file))}: ${size} KiB`);
  }
}

main();
