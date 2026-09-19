const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'robot-cad-sources');
const glbSources = [
  path.join(sourceRoot, 'decode-field.glb'),
  path.join(sourceRoot, 'DECODE™ presented by RTX Full Field - am-5700_Full.glb'),
];
const glbSource = glbSources.find((candidate) => fs.existsSync(candidate));
const objSource = path.join(sourceRoot, 'decode-field.obj');
const outputName = 'decode-field-optimized.glb';
const outputFile = path.join(repoRoot, 'static/simulator/models', outputName);
const manifestFile = path.join(repoRoot, 'static/simulator/models/decode-field.manifest.json');

function align4(value) {
  return (value + 3) & ~3;
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

function prepareUploadedGlb(source) {
  if (source.toString('ascii', 0, 4) !== 'glTF') throw new Error('The uploaded DECODE field is not a binary glTF file');
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
  const binaryHeader = 20 + jsonLength;
  const binaryLength = source.readUInt32LE(binaryHeader);
  const binary = source.subarray(binaryHeader + 8, binaryHeader + 8 + binaryLength);
  const removed = new Set();
  (json.nodes || []).forEach((node, index) => {
    if (/Driver Station .* Tape/i.test(node.name || '')) removed.add(index);
  });
  for (const node of json.nodes || []) {
    if (node.children) node.children = node.children.filter((index) => !removed.has(index));
  }
  for (const scene of json.scenes || []) {
    scene.nodes = (scene.nodes || []).filter((index) => !removed.has(index));
  }
  json.extras = {
    ...(json.extras || {}),
    telemarkDecodeField: true,
    modification: 'Prepared for browser presentation; outer driver-station tape subtrees removed.',
  };
  return encodeGlb(json, binary);
}

function objToGlb(source) {
  const vertices = [];
  const triangles = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('v ')) {
      const values = trimmed.slice(2).trim().split(/\s+/).slice(0, 3).map(Number);
      if (values.length === 3 && values.every(Number.isFinite)) vertices.push(values);
    } else if (trimmed.startsWith('f ')) {
      const face = trimmed.slice(2).trim().split(/\s+/).map((entry) => {
        const raw = Number(entry.split('/')[0]);
        return raw < 0 ? vertices.length + raw : raw - 1;
      });
      for (let index = 1; index + 1 < face.length; index++) triangles.push(face[0], face[index], face[index + 1]);
    }
  }
  if (!vertices.length || !triangles.length) throw new Error('decode-field.obj does not contain triangulatable geometry');
  if (triangles.some((index) => index < 0 || index >= vertices.length)) throw new Error('decode-field.obj contains an invalid face index');

  const normals = vertices.map(() => [0, 0, 0]);
  for (let index = 0; index < triangles.length; index += 3) {
    const a = vertices[triangles[index]];
    const b = vertices[triangles[index + 1]];
    const c = vertices[triangles[index + 2]];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    for (const vertexIndex of triangles.slice(index, index + 3)) {
      normals[vertexIndex][0] += normal[0];
      normals[vertexIndex][1] += normal[1];
      normals[vertexIndex][2] += normal[2];
    }
  }
  for (const normal of normals) {
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    normal[0] /= length;
    normal[1] /= length;
    normal[2] /= length;
  }

  const positions = Buffer.alloc(vertices.length * 12);
  const normalBytes = Buffer.alloc(normals.length * 12);
  vertices.forEach((vertex, index) => vertex.forEach((value, axis) => positions.writeFloatLE(value, index * 12 + axis * 4)));
  normals.forEach((normal, index) => normal.forEach((value, axis) => normalBytes.writeFloatLE(value, index * 12 + axis * 4)));
  const indices = Buffer.alloc(triangles.length * 4);
  triangles.forEach((value, index) => indices.writeUInt32LE(value, index * 4));
  const normalOffset = align4(positions.length);
  const indexOffset = align4(normalOffset + normalBytes.length);
  const binary = Buffer.alloc(indexOffset + indices.length);
  positions.copy(binary, 0);
  normalBytes.copy(binary, normalOffset);
  indices.copy(binary, indexOffset);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const vertex of vertices) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  }
  const json = {
    asset: {version: '2.0', generator: 'Telemark DECODE OBJ browser converter'},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{name: 'decode-field', mesh: 0}],
    meshes: [{name: 'decode-field', primitives: [{attributes: {POSITION: 0, NORMAL: 1}, indices: 2, material: 0}]}],
    materials: [{name: 'decode-field-neutral', pbrMetallicRoughness: {baseColorFactor: [0.55, 0.61, 0.66, 1], metallicFactor: 0, roughnessFactor: 0.82}}],
    accessors: [
      {bufferView: 0, componentType: 5126, count: vertices.length, type: 'VEC3', min, max},
      {bufferView: 1, componentType: 5126, count: normals.length, type: 'VEC3'},
      {bufferView: 2, componentType: 5125, count: triangles.length, type: 'SCALAR'},
    ],
    bufferViews: [
      {buffer: 0, byteOffset: 0, byteLength: positions.length, target: 34962},
      {buffer: 0, byteOffset: normalOffset, byteLength: normalBytes.length, target: 34962},
      {buffer: 0, byteOffset: indexOffset, byteLength: indices.length, target: 34963},
    ],
    buffers: [{byteLength: binary.length}],
  };
  return encodeGlb(json, binary);
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
if (glbSource) {
  const source = fs.readFileSync(glbSource);
  fs.writeFileSync(outputFile, prepareUploadedGlb(source));
  manifest.asset.status = 'uploaded-glb';
  manifest.asset.provenance = path.relative(repoRoot, glbSource);
} else if (fs.existsSync(objSource)) {
  fs.writeFileSync(outputFile, objToGlb(fs.readFileSync(objSource, 'utf8')));
  manifest.asset.status = 'converted-obj';
  manifest.asset.provenance = 'robot-cad-sources/decode-field.obj';
} else {
  console.log('No DECODE field upload found; retaining the procedural field fallback.');
  process.exit(0);
}
manifest.asset.browserAsset = outputName;
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared ${path.relative(repoRoot, outputFile)} from ${manifest.asset.provenance}`);
