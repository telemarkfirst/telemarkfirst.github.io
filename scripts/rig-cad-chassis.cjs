const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const wheelOrder = ['left-front', 'left-back', 'right-front', 'right-back'];

const jobs = [
  {
    file: 'static/simulator/models/30450-decode-robot-telemark.glb',
    spinAxis: 'x',
    cylinderAxis: 2,
    radius: 0.225,
    halfWidth: 0.105,
    anchors: {
      'left-front': [0.124, -0.630, -0.629],
      'left-back': [-0.741, 0.233, -0.629],
      'right-front': [0.126, -0.627, 0.629],
      'right-back': [-0.737, 0.236, 0.629],
    },
  },
  {
    file: 'static/simulator/models/quixilver-8404-itd-telemark.glb',
    spinAxis: 'z',
    cylinderAxis: 1,
    radius: 0.119,
    halfWidth: 0.048,
    anchors: {
      'left-front': [-0.868, -0.421, 0.435],
      'left-back': [-0.868, 0.396, 0.435],
      'right-front': [-0.090, -0.421, 0.435],
      'right-back': [-0.090, 0.396, 0.435],
    },
  },
  {
    file: 'static/simulator/models/2025-ftc-robot-manning-telemark.glb',
    spinAxis: 'x',
    cylinderAxis: 0,
    radius: 0.188,
    halfWidth: 0.125,
    anchors: {
      'left-front': [-0.474, 0.508, -0.783],
      'left-back': [-0.474, -0.519, -0.784],
      'right-front': [0.506, 0.508, -0.783],
      'right-back': [0.484, -0.519, -0.785],
    },
  },
  {
    file: 'static/simulator/models/2024-centerstage-manning-telemark.glb',
    // The source STEP is Z-up and these wheel axles run along raw Y. The
    // presentation's -90-degree X rotation maps that axle to rendered Z.
    spinAxis: 'z',
    cylinderAxis: 1,
    radius: 0.19,
    halfWidth: 0.16,
    anchors: {
      // The intake/sloped end is negative raw X. Facing that end, negative
      // raw Y is the robot's left and positive raw Y is its right.
      'left-front': [-0.478, -0.674, -0.808],
      'left-back': [0.741, -0.674, -0.800],
      'right-front': [-0.479, 0.660, -0.806],
      'right-back': [0.740, 0.660, -0.797],
    },
  },
  {
    file: 'static/simulator/models/ftc17438-inputoutput-telemark.glb',
    spinAxis: 'x',
    cylinderAxis: 0,
    radius: 0.207,
    halfWidth: 0.125,
    anchors: {
      'left-front': [-0.718, 0.527, -0.469],
      'left-back': [-0.726, -0.309, -0.467],
      'right-front': [0.726, 0.525, -0.467],
      'right-back': [0.726, -0.307, -0.471],
    },
  },
];

function classifyWheelEnvelope(triangleCenter, triangleVertices, job) {
  const radialAxes = [0, 1, 2].filter((axis) => axis !== job.cylinderAxis);
  let closest = null;
  let closestRadius = Infinity;
  for (const [name, anchor] of Object.entries(job.anchors)) {
    const axialDistance = Math.abs(triangleCenter[job.cylinderAxis] - anchor[job.cylinderAxis]);
    if (axialDistance > job.halfWidth) continue;
    const radialDistance = Math.hypot(
      triangleCenter[radialAxes[0]] - anchor[radialAxes[0]],
      triangleCenter[radialAxes[1]] - anchor[radialAxes[1]],
    );
    if (radialDistance > job.radius || radialDistance < (job.innerRadius || 0)) continue;
    if (radialDistance < closestRadius) {
      closest = name;
      closestRadius = radialDistance;
    }
  }
  if (!closest) return null;

  const anchor = job.anchors[closest];
  const boundaryTolerance = 0.012;
  const everyVertexInsideWheel = triangleVertices.every((vertex) => {
    const axialDistance = Math.abs(vertex[job.cylinderAxis] - anchor[job.cylinderAxis]);
    const radialDistance = Math.hypot(
      vertex[radialAxes[0]] - anchor[radialAxes[0]],
      vertex[radialAxes[1]] - anchor[radialAxes[1]],
    );
    return axialDistance <= job.halfWidth + boundaryTolerance
      && radialDistance <= job.radius + boundaryTolerance
      && radialDistance >= Math.max(0, (job.innerRadius || 0) - boundaryTolerance);
  });
  return everyVertexInsideWheel ? closest : null;
}

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

function createComponentMap(bytes, json, binStart, primitive) {
  const positionAccessor = json.accessors[primitive.attributes.POSITION];
  const positionView = json.bufferViews[positionAccessor.bufferView];
  const indexAccessor = json.accessors[primitive.indices];
  const indexView = json.bufferViews[indexAccessor.bufferView];
  if (positionAccessor.componentType !== 5122 || ![5121, 5123, 5125].includes(indexAccessor.componentType)) {
    throw new Error('The chassis rigger expects quantized INT16 positions and unsigned indices');
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
  for (let index = 0; index < indexAccessor.count; index++) {
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
      component = {
        root,
        triangles: 0,
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      };
      components.set(root, component);
    }
    for (let axis = 0; axis < 3; axis++) {
      const value = coordinates[index * 3 + axis] / 32767;
      component.min[axis] = Math.min(component.min[axis], value);
      component.max[axis] = Math.max(component.max[axis], value);
    }
  }
  for (let index = 0; index < indices.length; index += 3) {
    components.get(find(indices[index])).triangles++;
  }
  for (const component of components.values()) {
    component.center = component.min.map((value, axis) => (value + component.max[axis]) / 2);
    component.size = component.min.map((value, axis) => component.max[axis] - value);
  }

  function triangleCenter(offset) {
    const center = [0, 0, 0];
    for (let corner = 0; corner < 3; corner++) {
      const vertex = indices[offset + corner];
      for (let axis = 0; axis < 3; axis++) center[axis] += coordinates[vertex * 3 + axis] / (32767 * 3);
    }
    return center;
  }

  function triangleVertices(offset) {
    return [0, 1, 2].map((corner) => {
      const vertex = indices[offset + corner];
      return [0, 1, 2].map((axis) => coordinates[vertex * 3 + axis] / 32767);
    });
  }

  function vertexCoordinates(vertex) {
    return [0, 1, 2].map((axis) => coordinates[vertex * 3 + axis] / 32767);
  }

  return {
    find,
    components,
    indices,
    indexAccessor,
    indexView,
    triangleCenter,
    triangleVertices,
    vertexCoordinates,
  };
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
  const viewIndex = json.bufferViews.push({
    buffer: 0,
    byteOffset: offset,
    byteLength: buffer.length,
    target,
  }) - 1;
  return json.accessors.push({
    type: 'SCALAR',
    componentType: 5125,
    count: values.length,
    bufferView: viewIndex,
    byteOffset: 0,
  }) - 1;
}

function readIndices(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Array(accessor.count);
  const readers = {
    5121: {width: 1, read: (offset) => bin.readUInt8(offset)},
    5123: {width: 2, read: (offset) => bin.readUInt16LE(offset)},
    5125: {width: 4, read: (offset) => bin.readUInt32LE(offset)},
  };
  const reader = readers[accessor.componentType];
  if (!reader) throw new Error(`Unsupported index component type ${accessor.componentType}`);
  for (let index = 0; index < accessor.count; index++) values[index] = reader.read(start + index * reader.width);
  return values;
}

function primitiveSignature(primitive) {
  const signature = {...primitive};
  delete signature.indices;
  return JSON.stringify(signature);
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

function copyTransform(node) {
  const transform = {};
  for (const key of ['translation', 'rotation', 'scale', 'matrix']) {
    if (node[key] !== undefined) transform[key] = node[key];
  }
  return transform;
}

function unrigJob(job) {
  const file = path.join(repoRoot, job.file);
  const {json, bin} = parseGlb(file);
  if (!json.extras?.telemarkCadChassis) return false;

  const chassisNode = json.nodes.find((node) => node.name === 'telemark-cad-chassis');
  const wheelNodeEntries = json.nodes
    .map((node, index) => ({node, index}))
    .filter(({node}) => /^telemark-cad-wheel-(left|right)-(front|back)$/.test(node.name || ''));
  if (!chassisNode || wheelNodeEntries.length !== wheelOrder.length) {
    throw new Error(`${job.file} does not contain a complete previous chassis rig`);
  }

  const chassisMesh = json.meshes[chassisNode.mesh];
  const outputBin = {parts: [bin], byteLength: bin.length};
  chassisMesh.primitives.forEach((chassisPrimitive) => {
    const signature = primitiveSignature(chassisPrimitive);
    const combined = readIndices(json, bin, chassisPrimitive.indices);
    for (const {node} of wheelNodeEntries) {
      for (const wheelPrimitive of json.meshes[node.mesh].primitives) {
        if (primitiveSignature(wheelPrimitive) !== signature) continue;
        const wheelIndices = readIndices(json, bin, wheelPrimitive.indices);
        for (const index of wheelIndices) combined.push(index);
      }
    }
    chassisPrimitive.indices = appendIndices(
      json,
      outputBin,
      combined,
      json.bufferViews[json.accessors[chassisPrimitive.indices].bufferView].target,
    );
  });

  const retiredIndices = new Set(wheelNodeEntries.map(({index}) => index));
  for (const scene of json.scenes) scene.nodes = scene.nodes.filter((index) => !retiredIndices.has(index));
  for (const {node} of wheelNodeEntries) {
    node.name = `retired-${node.name}`;
    node.extras = {telemarkCadWheelRetired: true};
  }
  delete json.extras.telemarkCadChassis;
  delete json.extras.telemarkCadWheels;

  const finalBin = Buffer.concat(outputBin.parts);
  json.buffers[0].byteLength = finalBin.length;
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(json, finalBin));
  fs.renameSync(temporary, file);
  return true;
}

function compactJob(job) {
  const file = path.join(repoRoot, job.file);
  const {json, bin} = parseGlb(file);
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
  const binParts = [];
  const bufferViews = [];
  let byteLength = 0;
  for (const oldIndex of orderedViews) {
    const oldView = json.bufferViews[oldIndex];
    const offset = align4(byteLength);
    if (offset > byteLength) binParts.push(Buffer.alloc(offset - byteLength));
    binParts.push(Buffer.from(bin.subarray(oldView.byteOffset || 0, (oldView.byteOffset || 0) + oldView.byteLength)));
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
  const finalBin = Buffer.concat(binParts);
  json.buffers[0].byteLength = finalBin.length;
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(json, finalBin));
  fs.renameSync(temporary, file);
}

function rigJob(job, dryRun, rebuild, compact) {
  const file = path.join(repoRoot, job.file);
  let parsed = parseGlb(file);
  if (parsed.json.extras?.telemarkCadChassis && rebuild) {
    if (dryRun) throw new Error('--dry-run cannot be combined with --rebuild');
    unrigJob(job);
    parsed = parseGlb(file);
  }
  const {bytes, json, bin, binStart} = parsed;
  if (json.extras?.telemarkCadChassis) {
    if (compact) compactJob(job);
    console.log(`${job.file}: already rigged`);
    return;
  }

  const chassisNode = json.nodes.find((node) => node.name === 'telemark-cad-chassis')
    || json.nodes.find((node) => node.mesh !== undefined);
  if (!chassisNode) throw new Error(`${job.file} does not contain a chassis mesh node`);
  const chassisMesh = json.meshes[chassisNode.mesh];
  const selectedPrimitives = new Set(job.primitiveIndices || chassisMesh.primitives.map((_, index) => index));
  const wheelPrimitives = Object.fromEntries(wheelOrder.map((name) => [name, []]));
  const triangleCounts = Object.fromEntries(wheelOrder.map((name) => [name, 0]));
  const wheelBounds = Object.fromEntries(wheelOrder.map((name) => [name, {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }]));
  const outputBin = {parts: [bin], byteLength: bin.length};

  chassisMesh.primitives.forEach((primitive, primitiveIndex) => {
    if (!selectedPrimitives.has(primitiveIndex)) return;
    const graph = createComponentMap(bytes, json, binStart, primitive);
    const chassisIndices = [];
    const wheelIndices = Object.fromEntries(wheelOrder.map((name) => [name, []]));

    for (let offset = 0; offset < graph.indices.length; offset += 3) {
      const component = graph.components.get(graph.find(graph.indices[offset]));
      const triangleCenter = graph.triangleCenter(offset);
      const wheel = job.classify
        ? job.classify({component, triangleCenter, primitiveIndex, job})
        : classifyWheelEnvelope(triangleCenter, graph.triangleVertices(offset), job);
      const target = wheelIndices[wheel] || chassisIndices;
      target.push(graph.indices[offset], graph.indices[offset + 1], graph.indices[offset + 2]);
      if (wheelIndices[wheel]) {
        for (let corner = 0; corner < 3; corner++) {
          const coordinates = graph.vertexCoordinates(graph.indices[offset + corner]);
          for (let axis = 0; axis < 3; axis++) {
            wheelBounds[wheel].min[axis] = Math.min(wheelBounds[wheel].min[axis], coordinates[axis]);
            wheelBounds[wheel].max[axis] = Math.max(wheelBounds[wheel].max[axis], coordinates[axis]);
          }
        }
      }
    }

    if (!chassisIndices.length) throw new Error(`${job.file} primitive ${primitiveIndex} produced an empty chassis`);
    primitive.indices = appendIndices(json, outputBin, chassisIndices, graph.indexView.target);

    for (const name of wheelOrder) {
      if (!wheelIndices[name].length) continue;
      triangleCounts[name] += wheelIndices[name].length / 3;
      const accessor = appendIndices(json, outputBin, wheelIndices[name], graph.indexView.target);
      wheelPrimitives[name].push({...primitive, indices: accessor});
    }
  });

  for (const name of wheelOrder) {
    if (!wheelPrimitives[name].length || triangleCounts[name] < 100) {
      throw new Error(`${job.file} did not expose enough real CAD geometry for ${name}`);
    }
  }

  console.log(`${job.file}: ${wheelOrder.map((name) => `${name}=${triangleCounts[name]}`).join(', ')} triangles`);
  if (dryRun) return;

  chassisNode.name = 'telemark-cad-chassis';
  chassisMesh.name = 'telemark-cad-chassis';
  for (const name of wheelOrder) {
    const nodeName = `telemark-cad-wheel-${name}`;
    const bounds = wheelBounds[name];
    const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2);
    const meshIndex = json.meshes.push({name: nodeName, primitives: wheelPrimitives[name]}) - 1;
    const nodeIndex = json.nodes.push({
      name: nodeName,
      ...copyTransform(chassisNode),
      mesh: meshIndex,
      extras: {
        telemarkCadWheel: name,
        spinAxis: job.spinAxis,
        telemarkCadCenter: center,
        telemarkCadBounds: bounds,
      },
    }) - 1;
    for (const scene of json.scenes) scene.nodes.push(nodeIndex);
  }

  const finalBin = Buffer.concat(outputBin.parts);
  json.buffers[0].byteLength = finalBin.length;
  json.extras = {
    ...(json.extras || {}),
    telemarkCadChassis: true,
    telemarkCadWheels: wheelOrder,
    modification: `${json.extras?.modification || ''} Existing CAD wheel geometry partitioned into four independently movable chassis wheel nodes.`.trim(),
  };

  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, encodeGlb(json, finalBin));
  fs.renameSync(temporary, file);
  if (compact) compactJob(job);
}

const dryRun = process.argv.includes('--dry-run');
const rebuild = process.argv.includes('--rebuild');
const compact = process.argv.includes('--compact');
const modelArgument = process.argv.find((argument) => argument.startsWith('--model='));
const selectedModel = modelArgument && modelArgument.slice('--model='.length);
const selectedJobs = selectedModel
  ? jobs.filter((job) => path.basename(job.file) === selectedModel)
  : jobs;
if (selectedModel && selectedJobs.length === 0) throw new Error(`Unknown CAD model: ${selectedModel}`);
for (const job of selectedJobs) rigJob(job, dryRun, rebuild, compact);
