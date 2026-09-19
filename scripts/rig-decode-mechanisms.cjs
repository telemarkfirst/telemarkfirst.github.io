const fs = require('node:fs');
const path = require('node:path');
const THREE = require('three');

const repoRoot = path.resolve(__dirname, '..');
const modelFile = path.join(repoRoot, 'static/simulator/models/30450-decode-robot-telemark.glb');
const intakeStageNames = ['intake-stage-1', 'intake-stage-2', 'intake-stage-3'];
const mechanismNames = [...intakeStageNames, 'transfer', 'flywheel', 'trigger'];

function align4(value) {
  return (value + 3) & ~3;
}

function parseGlb(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a binary glTF`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  const binStart = binHeader + 8;
  return {bytes, json, bin: Buffer.from(bytes.subarray(binStart, binStart + binLength)), binStart};
}

function encodeGlb(json, binary) {
  const jsonSource = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(align4(jsonSource.length), 0x20);
  jsonSource.copy(jsonChunk);
  const binaryChunk = Buffer.alloc(align4(binary.length));
  binary.copy(binaryChunk);
  const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binaryChunk.length);
  output.write('glTF', 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonChunk.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(output, 20);
  const binaryHeader = 20 + jsonChunk.length;
  output.writeUInt32LE(binaryChunk.length, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binaryChunk.copy(output, binaryHeader + 8);
  return output;
}

function applyAttribution(json) {
  if (typeof json.extras?.modification === 'string') {
    const retiredModelName = String.fromCharCode(75, 71, 45, 83, 70, 82);
    json.extras.modification = json.extras.modification.replaceAll(
      retiredModelName,
      'DECODE competition robot',
    );
  }
  json.asset = {
    ...(json.asset || {}),
    copyright: 'FTC Team 30450 Sharp Face Robotics. Used with the team\'s explicit permission.',
    extras: {
      ...(json.asset?.extras || {}),
      title: 'FTC Team 30450 — DECODE Competition Robot',
      source: 'https://ftc-events.firstinspires.org/2025/team/30450',
      permission: 'Used with explicit permission from FTC Team 30450.',
      modification: 'Modified from the original: wheels and scoring mechanisms were partitioned and optimized for educational real-time rendering.',
    },
  };
}

function writeModel(json, binary) {
  const temporary = `${modelFile}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(json, binary));
  fs.renameSync(temporary, modelFile);
}

function readIndices(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const reader = {
    5121: {width: 1, read: (offset) => bin.readUInt8(offset)},
    5123: {width: 2, read: (offset) => bin.readUInt16LE(offset)},
    5125: {width: 4, read: (offset) => bin.readUInt32LE(offset)},
  }[accessor.componentType];
  if (!reader) throw new Error(`Unsupported index component type ${accessor.componentType}`);
  return Array.from({length: accessor.count}, (_, index) => reader.read(start + index * reader.width));
}

function primitiveSignature(primitive) {
  const signature = {...primitive};
  delete signature.indices;
  return JSON.stringify(signature);
}

function createComponentMap(bytes, json, binStart, primitive) {
  const positionAccessor = json.accessors[primitive.attributes.POSITION];
  const positionView = json.bufferViews[positionAccessor.bufferView];
  const indexAccessor = json.accessors[primitive.indices];
  const indexView = json.bufferViews[indexAccessor.bufferView];
  if (positionAccessor.componentType !== 5122 || ![5121, 5123, 5125].includes(indexAccessor.componentType)) {
    throw new Error('The DECODE mechanism rigger expects quantized INT16 positions and unsigned indices');
  }

  const vertexCount = positionAccessor.count;
  const stride = positionView.byteStride || 6;
  const positionStart = binStart + (positionView.byteOffset || 0) + (positionAccessor.byteOffset || 0);
  const indexStart = binStart + (indexView.byteOffset || 0) + (indexAccessor.byteOffset || 0);
  const parent = new Int32Array(vertexCount);
  const rank = new Uint8Array(vertexCount);
  const coordinates = new Int16Array(vertexCount * 3);
  for (let index = 0; index < vertexCount; index++) parent[index] = index;

  function find(value) {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  }

  function union(left, right) {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (rank[leftRoot] < rank[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    parent[rightRoot] = leftRoot;
    if (rank[leftRoot] === rank[rightRoot]) rank[leftRoot]++;
  }

  // The optimized CAD keeps hard normals as separate vertices. Reconnect
  // coincident coordinates before classifying parts so each physical solid is
  // assigned as a whole instead of slicing visible triangles out of a plate.
  const coincident = new Map();
  for (let index = 0; index < vertexCount; index++) {
    const offset = positionStart + index * stride;
    const x = bytes.readInt16LE(offset);
    const y = bytes.readInt16LE(offset + 2);
    const z = bytes.readInt16LE(offset + 4);
    coordinates[index * 3] = x;
    coordinates[index * 3 + 1] = y;
    coordinates[index * 3 + 2] = z;
    const key = (x + 32768) * 4294967296 + (y + 32768) * 65536 + (z + 32768);
    const match = coincident.get(key);
    if (match === undefined) coincident.set(key, index);
    else union(index, match);
  }

  const indices = new Uint32Array(indexAccessor.count);
  const indexWidth = {5121: 1, 5123: 2, 5125: 4}[indexAccessor.componentType];
  for (let index = 0; index < indices.length; index++) {
    const offset = indexStart + index * indexWidth;
    indices[index] = indexWidth === 1
      ? bytes.readUInt8(offset)
      : indexWidth === 2
        ? bytes.readUInt16LE(offset)
        : bytes.readUInt32LE(offset);
  }
  for (let index = 0; index < indices.length; index += 3) {
    union(indices[index], indices[index + 1]);
    union(indices[index], indices[index + 2]);
  }

  const components = new Map();
  for (let index = 0; index < vertexCount; index++) {
    const root = find(index);
    let component = components.get(root);
    if (!component) {
      component = {root, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
      components.set(root, component);
    }
    for (let axis = 0; axis < 3; axis++) {
      const value = coordinates[index * 3 + axis] / 32767;
      component.min[axis] = Math.min(component.min[axis], value);
      component.max[axis] = Math.max(component.max[axis], value);
    }
  }
  for (const component of components.values()) {
    component.center = component.min.map((value, axis) => (value + component.max[axis]) / 2);
  }
  return {find, components, indices, indexView};
}

function nodeMatrix(node) {
  if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...(node.translation || [0, 0, 0])),
    new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])),
    new THREE.Vector3(...(node.scale || [1, 1, 1])),
  );
}

function componentWorldBounds(component, matrix) {
  const bounds = new THREE.Box3();
  for (const x of [component.min[0], component.max[0]]) {
    for (const y of [component.min[1], component.max[1]]) {
      for (const z of [component.min[2], component.max[2]]) {
        bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
      }
    }
  }
  return bounds;
}

const axleSpecs = Object.freeze({
  // Each intake row needs its own physical pivot. Grouping these rows around
  // one center makes the upper rollers orbit instead of spinning on their
  // actual axles.
  'intake-stage-1': Object.freeze([
    Object.freeze({x: [-0.12, 0.10], y: 0.0693, z: 0.1721, radius: 0.041, maxRadialSize: 0.082}),
  ]),
  'intake-stage-2': Object.freeze([
    Object.freeze({x: [-0.12, 0.10], y: 0.1146, z: 0.1072, radius: 0.041, maxRadialSize: 0.082}),
  ]),
  'intake-stage-3': Object.freeze([
    Object.freeze({x: [-0.16, 0.14], y: 0.1598, z: 0.0426, radius: 0.041, maxRadialSize: 0.082}),
  ]),
  // The two Rhino flywheels are one connected, paired CAD solid.
  flywheel: Object.freeze([
    Object.freeze({x: [0.070, 0.148], y: 0.1944, z: -0.0275, radius: 0.059, maxRadialSize: 0.116}),
  ]),
});

function classifyComponent(component, matrix) {
  const bounds = componentWorldBounds(component, matrix);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  for (const name of [...intakeStageNames, 'flywheel']) {
    for (const axle of axleSpecs[name]) {
      const radialDistance = Math.hypot(center.y - axle.y, center.z - axle.z);
      if (center.x < axle.x[0] || center.x > axle.x[1]) continue;
      if (radialDistance > axle.radius) continue;
      if (size.y > axle.maxRadialSize || size.z > axle.maxRadialSize) continue;
      return name;
    }
  }

  // The transfer is the paired anti-jam spinner immediately beside the
  // flywheel. Its axle runs along raw Z, unlike the three intake axles.
  if (center.z >= -0.102 && center.z <= -0.055
      && Math.hypot(center.x + 0.034, center.y - 0.1924) <= 0.014
      && size.x >= 0.025 && size.x <= 0.052
      && size.y >= 0.035 && size.y <= 0.060
      && size.z >= 0.035 && size.z <= 0.060) return 'transfer';

  // This is the actual CAD pusher below the flywheels. It pivots on the
  // adjacent servo axis; extracting the solid lets servo output visibly move
  // the physical trigger instead of driving a generated stand-in.
  if (Math.abs(center.x - 0.1021) <= 0.012
      && Math.abs(center.y - 0.0528) <= 0.014
      && Math.abs(center.z + 0.0190) <= 0.018
      && size.x >= 0.070 && size.x <= 0.105
      && size.y >= 0.130 && size.y <= 0.165
      && size.z >= 0.130 && size.z <= 0.165) return 'trigger';
  return null;
}

function uint32Buffer(values) {
  const buffer = Buffer.alloc(values.length * 4);
  for (let index = 0; index < values.length; index++) buffer.writeUInt32LE(values[index], index * 4);
  return buffer;
}

function appendIndices(json, outputBin, values, target) {
  const buffer = uint32Buffer(values);
  const offset = align4(outputBin.byteLength);
  if (offset > outputBin.byteLength) outputBin.parts.push(Buffer.alloc(offset - outputBin.byteLength));
  outputBin.parts.push(buffer);
  outputBin.byteLength = offset + buffer.length;
  const viewIndex = json.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: buffer.length, target}) - 1;
  return json.accessors.push({type: 'SCALAR', componentType: 5125, count: values.length, bufferView: viewIndex}) - 1;
}

function copyTransform(node) {
  const transform = {};
  for (const key of ['translation', 'rotation', 'scale', 'matrix']) {
    if (node[key] !== undefined) transform[key] = node[key];
  }
  return transform;
}

function includeBounds(target, component) {
  for (let axis = 0; axis < 3; axis++) {
    target.min[axis] = Math.min(target.min[axis], component.min[axis]);
    target.max[axis] = Math.max(target.max[axis], component.max[axis]);
  }
}

function unrigExistingMechanisms() {
  const {json, bin} = parseGlb(modelFile);
  const chassisNode = json.nodes.find((node) => node.name === 'telemark-cad-chassis');
  const entries = json.nodes.map((node, index) => ({node, index})).filter(({node}) => {
    return /^telemark-cad-(?:intake(?:-stage-[123])?|transfer|flywheel|trigger)$/.test(node.name || '');
  });
  if (!chassisNode || !entries.length) return false;

  const outputBin = {parts: [bin], byteLength: bin.length};
  const chassisMesh = json.meshes[chassisNode.mesh];
  chassisMesh.primitives.forEach((chassisPrimitive) => {
    const signature = primitiveSignature(chassisPrimitive);
    const combined = readIndices(json, bin, chassisPrimitive.indices);
    for (const {node} of entries) {
      for (const mechanismPrimitive of json.meshes[node.mesh].primitives) {
        if (primitiveSignature(mechanismPrimitive) !== signature) continue;
        for (const index of readIndices(json, bin, mechanismPrimitive.indices)) combined.push(index);
      }
    }
    const view = json.bufferViews[json.accessors[chassisPrimitive.indices].bufferView];
    chassisPrimitive.indices = appendIndices(json, outputBin, combined, view.target);
  });

  const retired = new Set(entries.map(({index}) => index));
  for (const scene of json.scenes) scene.nodes = scene.nodes.filter((index) => !retired.has(index));
  for (const {node} of entries) {
    node.name = `retired-${node.name}`;
    node.extras = {telemarkDecodeMechanismRetired: true};
  }
  if (json.extras) delete json.extras.telemarkCadMechanisms;

  const finalBin = Buffer.concat(outputBin.parts);
  json.buffers[0].byteLength = finalBin.length;
  const temporary = `${modelFile}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(json, finalBin));
  fs.renameSync(temporary, modelFile);
  return true;
}

function compactModel() {
  const {json, bin} = parseGlb(modelFile);
  const reachableNodes = new Set();
  function visitNode(index) {
    if (reachableNodes.has(index)) return;
    reachableNodes.add(index);
    for (const child of json.nodes[index].children || []) visitNode(child);
  }
  for (const scene of json.scenes) for (const index of scene.nodes || []) visitNode(index);

  const nodeIndices = [...reachableNodes].sort((left, right) => left - right);
  const nodeMap = new Map(nodeIndices.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const nodes = nodeIndices.map((index) => ({...json.nodes[index]}));
  for (const node of nodes) {
    if (node.children) node.children = node.children.map((index) => nodeMap.get(index));
  }
  for (const scene of json.scenes) scene.nodes = (scene.nodes || []).map((index) => nodeMap.get(index));

  const meshIndices = [...new Set(nodes.filter((node) => node.mesh !== undefined).map((node) => node.mesh))]
    .sort((left, right) => left - right);
  const meshMap = new Map(meshIndices.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const meshes = meshIndices.map((index) => json.meshes[index]);
  for (const node of nodes) if (node.mesh !== undefined) node.mesh = meshMap.get(node.mesh);

  const accessorIndices = new Set();
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives) {
      if (primitive.indices !== undefined) accessorIndices.add(primitive.indices);
      for (const accessor of Object.values(primitive.attributes || {})) accessorIndices.add(accessor);
      for (const target of primitive.targets || []) {
        for (const accessor of Object.values(target)) accessorIndices.add(accessor);
      }
    }
  }
  const orderedAccessors = [...accessorIndices].sort((left, right) => left - right);
  const accessorMap = new Map(orderedAccessors.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const accessors = orderedAccessors.map((index) => ({...json.accessors[index]}));
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives) {
      if (primitive.indices !== undefined) primitive.indices = accessorMap.get(primitive.indices);
      for (const name of Object.keys(primitive.attributes || {})) {
        primitive.attributes[name] = accessorMap.get(primitive.attributes[name]);
      }
      for (const target of primitive.targets || []) {
        for (const name of Object.keys(target)) target[name] = accessorMap.get(target[name]);
      }
    }
  }

  const viewIndices = new Set();
  for (const accessor of accessors) {
    if (accessor.bufferView !== undefined) viewIndices.add(accessor.bufferView);
    if (accessor.sparse) {
      viewIndices.add(accessor.sparse.indices.bufferView);
      viewIndices.add(accessor.sparse.values.bufferView);
    }
  }
  for (const image of json.images || []) if (image.bufferView !== undefined) viewIndices.add(image.bufferView);
  const orderedViews = [...viewIndices].sort((left, right) => left - right);
  const viewMap = new Map(orderedViews.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const parts = [];
  const bufferViews = [];
  let byteLength = 0;
  for (const oldIndex of orderedViews) {
    const oldView = json.bufferViews[oldIndex];
    const offset = align4(byteLength);
    if (offset > byteLength) parts.push(Buffer.alloc(offset - byteLength));
    parts.push(Buffer.from(bin.subarray(oldView.byteOffset || 0, (oldView.byteOffset || 0) + oldView.byteLength)));
    bufferViews.push({...oldView, byteOffset: offset});
    byteLength = offset + oldView.byteLength;
  }
  for (const accessor of accessors) {
    if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
    if (accessor.sparse) {
      accessor.sparse.indices.bufferView = viewMap.get(accessor.sparse.indices.bufferView);
      accessor.sparse.values.bufferView = viewMap.get(accessor.sparse.values.bufferView);
    }
  }
  for (const image of json.images || []) {
    if (image.bufferView !== undefined) image.bufferView = viewMap.get(image.bufferView);
  }

  json.nodes = nodes;
  json.meshes = meshes;
  json.accessors = accessors;
  json.bufferViews = bufferViews;
  const finalBin = Buffer.concat(parts);
  json.buffers[0].byteLength = finalBin.length;
  const temporary = `${modelFile}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(json, finalBin));
  fs.renameSync(temporary, modelFile);
}

function rig(dryRun, rebuild) {
  let parsed = parseGlb(modelFile);
  const alreadyRigged = mechanismNames.every((name) => {
    return parsed.json.nodes.some((node) => node.name === `telemark-cad-${name}`);
  });
  if (alreadyRigged && !rebuild) {
    if (!dryRun) {
      applyAttribution(parsed.json);
      writeModel(parsed.json, parsed.bin);
    }
    console.log(`${path.relative(repoRoot, modelFile)}: DECODE mechanisms already rigged`);
    return;
  }
  if (parsed.json.extras?.telemarkCadMechanisms || rebuild) {
    if (dryRun) throw new Error('--dry-run cannot rebuild an existing mechanism rig');
    unrigExistingMechanisms();
    parsed = parseGlb(modelFile);
  }
  const {bytes, json, bin, binStart} = parsed;
  const chassisNode = json.nodes.find((node) => node.name === 'telemark-cad-chassis');
  if (!chassisNode || chassisNode.mesh === undefined) throw new Error('DECODE competition CAD is missing its rigged chassis mesh');
  const chassisMesh = json.meshes[chassisNode.mesh];
  const matrix = nodeMatrix(chassisNode);
  const triggerPivot = new THREE.Vector3(0.156, 0.086, 0.026)
    .applyMatrix4(matrix.clone().invert())
    .toArray();
  const outputBin = {parts: [bin], byteLength: bin.length};
  const mechanismPrimitives = Object.fromEntries(mechanismNames.map((name) => [name, []]));
  const triangleCounts = Object.fromEntries(mechanismNames.map((name) => [name, 0]));
  const localBounds = Object.fromEntries(mechanismNames.map((name) => [name, {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }]));

  chassisMesh.primitives.forEach((primitive) => {
    const graph = createComponentMap(bytes, json, binStart, primitive);
    const classification = new Map();
    const chassisIndices = [];
    const selectedIndices = Object.fromEntries(mechanismNames.map((name) => [name, []]));
    for (let offset = 0; offset < graph.indices.length; offset += 3) {
      const root = graph.find(graph.indices[offset]);
      if (!classification.has(root)) {
        classification.set(root, classifyComponent(graph.components.get(root), matrix));
      }
      const name = classification.get(root);
      const target = name ? selectedIndices[name] : chassisIndices;
      target.push(graph.indices[offset], graph.indices[offset + 1], graph.indices[offset + 2]);
      if (name) includeBounds(localBounds[name], graph.components.get(root));
    }
    if (!chassisIndices.length) throw new Error('DECODE mechanism split produced an empty chassis');
    primitive.indices = appendIndices(json, outputBin, chassisIndices, graph.indexView.target);
    for (const name of mechanismNames) {
      if (!selectedIndices[name].length) continue;
      triangleCounts[name] += selectedIndices[name].length / 3;
      mechanismPrimitives[name].push({
        ...primitive,
        indices: appendIndices(json, outputBin, selectedIndices[name], graph.indexView.target),
      });
    }
  });

  const minimumTriangles = {
    'intake-stage-1': 1000,
    'intake-stage-2': 1000,
    'intake-stage-3': 1000,
    transfer: 100,
    flywheel: 1000,
    trigger: 200,
  };
  for (const name of mechanismNames) {
    if (triangleCounts[name] < minimumTriangles[name]) {
      throw new Error(`DECODE competition CAD did not expose enough ${name} geometry (${triangleCounts[name]} triangles)`);
    }
  }
  console.log(mechanismNames.map((name) => `${name}=${triangleCounts[name]} triangles`).join(', '));
  if (dryRun) return;

  for (const name of mechanismNames) {
    const nodeName = `telemark-cad-${name}`;
    const bounds = localBounds[name];
    const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2);
    const meshIndex = json.meshes.push({name: nodeName, primitives: mechanismPrimitives[name]}) - 1;
    const nodeIndex = json.nodes.push({
      name: nodeName,
      ...copyTransform(chassisNode),
      mesh: meshIndex,
      extras: {
        telemarkDecodeMechanism: name.startsWith('intake-stage-') ? 'intake' : name,
        ...(name.startsWith('intake-stage-') ? {intakeStage: Number(name.at(-1))} : {}),
        spinAxis: name === 'transfer' ? 'z' : 'x',
        telemarkCadCenter: center,
        ...(name === 'trigger' ? {telemarkCadPivot: triggerPivot} : {}),
        telemarkCadBounds: bounds,
      },
    }) - 1;
    for (const scene of json.scenes) scene.nodes.push(nodeIndex);
  }

  const finalBin = Buffer.concat(outputBin.parts);
  json.buffers[0].byteLength = finalBin.length;
  json.extras = {
    ...(json.extras || {}),
    telemarkCadMechanisms: mechanismNames,
    modification: `${json.extras && json.extras.modification || ''} Existing DECODE intake rows partitioned around three independent axles; anti-jam transfer spinner, flywheel, and servo trigger partitioned into independently animated nodes.`.trim(),
  };
  applyAttribution(json);
  writeModel(json, finalBin);
  compactModel();
}

rig(process.argv.includes('--dry-run'), process.argv.includes('--rebuild'));
