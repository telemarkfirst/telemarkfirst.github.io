const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'telemark-dependency-check-'));
  try {
    const coreRequire = createRequire(require.resolve('@docusaurus/core/package.json'));
    const {default: Tinypool} = await import(pathToFileURL(coreRequire.resolve('tinypool')).href);
    const worker = path.join(dir, 'worker.mjs');
    await fs.writeFile(worker, "import {workerData} from 'node:worker_threads'; export default ({n}) => n + workerData[1].offset;");
    const pool = new Tinypool({filename: worker, minThreads: 2, maxThreads: 2, concurrentTasksPerWorker: 1,
      runtime: 'worker_threads', isolateWorkers: false, workerData: {offset: 10}, maxMemoryLimitBeforeRecycle: 1000000000});
    try {
      assert.deepEqual(await Promise.all([1, 2, 3].map((n) => pool.run({n}))), [11, 12, 13]);
      // Inherited run options must not redirect a worker to another module.
      assert.equal(await pool.run({n: 4}, Object.create({filename: path.join(dir, 'missing-malicious-worker.mjs')})), 14);
    } finally {await pool.destroy();}

    for (const parent of ['copy-webpack-plugin', 'css-minimizer-webpack-plugin']) {
      const parentRequire = createRequire(require.resolve(parent));
      const serialize = parentRequire('serialize-javascript');
      const value = {pattern: /robots/gi, date: new Date('2026-01-01'), fn: (x) => x + 1};
      const restored = new Function(`return (${serialize(value)})`)();
      assert.equal(restored.fn(3), 4);
      assert.equal(restored.pattern.source, 'robots');
      assert.equal(restored.date.toISOString(), value.date.toISOString());
      function f() {} f.toString = () => 'function f(){ return 1 }//</script';
      function g() {} g.toString = () => 'function g(x){ return x } > <img src=x onerror=alert(1)>';
      assert.doesNotMatch(serialize({a: {f}, g}, {space: 2}), /<\/script/i);
    }

    const webpack = require('webpack');
    const CopyPlugin = require('copy-webpack-plugin');
    const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
    await fs.writeFile(path.join(dir, 'entry.js'), 'console.log("compatibility fixture");');
    await fs.writeFile(path.join(dir, 'input.css'), 'a { color: rgb(255, 0, 0); margin: 0px; }');
    const compiler = webpack({mode: 'production', entry: path.join(dir, 'entry.js'), output: {path: path.join(dir, 'dist')},
      plugins: [new CopyPlugin({patterns: [{from: path.join(dir, 'input.css'), to: 'style.css',
        transform: {transformer: (source) => source, cache: true}}]})],
      optimization: {minimizer: [new CssMinimizerPlugin({parallel: 2})]}});
    try {
      await new Promise((resolve, reject) => compiler.run((error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString())) : resolve()));
      assert.match(await fs.readFile(path.join(dir, 'dist/style.css'), 'utf8'), /a\{color:red;margin:0\}/);
    } finally {await new Promise((resolve, reject) => compiler.close((error) => error ? reject(error) : resolve()));}

    const firestoreRequire = createRequire(require.resolve('@firebase/firestore'));
    const grpc = firestoreRequire('@grpc/grpc-js');
    const service = {echo: {path: '/fixture/Echo', requestStream: false, responseStream: false,
      requestSerialize: (v) => Buffer.from(JSON.stringify(v)), requestDeserialize: (v) => JSON.parse(v),
      responseSerialize: (v) => Buffer.from(JSON.stringify(v)), responseDeserialize: (v) => JSON.parse(v)}};
    const server = new grpc.Server();
    server.addService(service, {echo: (call, callback) => callback(null, call.request)});
    let client;
    try {
      const port = await new Promise((resolve, reject) => server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (error, port) => error ? reject(error) : resolve(port)));
      const Client = grpc.makeGenericClientConstructor(service, 'Fixture');
      client = new Client(`127.0.0.1:${port}`, grpc.credentials.createInsecure());
      const reply = await new Promise((resolve, reject) => client.echo({synthetic: true}, {deadline: Date.now() + 5000}, (error, value) => error ? reject(error) : resolve(value)));
      assert.deepEqual(reply, {synthetic: true});
    } finally {client?.close(); server.forceShutdown();}

    const expressRequire = createRequire(require.resolve('express'));
    const qs = expressRequire('qs');
    assert.deepEqual(qs.parse('lesson[unit]=3&tag[]=motor&tag[]=sensor'), {lesson: {unit: '3'}, tag: ['motor', 'sensor']});
    assert.equal(qs.stringify({a: [null, undefined]}, {arrayFormat: 'comma', encodeValuesOnly: true}), 'a=,');
    const sockjs = require('sockjs');
    const http = require('node:http');
    const WebSocket = require('ws');
    const httpServer = http.createServer();
    const sockServer = sockjs.createServer({log: () => {}});
    sockServer.on('connection', (connection) => connection.on('data', (data) => connection.write(data)));
    sockServer.installHandlers(httpServer, {prefix: '/fixture'});
    let socket;
    try {
      await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
      const received = await new Promise((resolve, reject) => {
        socket = new WebSocket(`ws://127.0.0.1:${httpServer.address().port}/fixture/000/session/websocket`);
        const timeout = setTimeout(() => reject(Error('SockJS fixture timed out')), 5000);
        socket.on('error', (error) => {clearTimeout(timeout); reject(error);});
        socket.on('message', (data) => {
          const frame = data.toString();
          if (frame === 'o') socket.send(JSON.stringify(['synthetic echo']));
          if (frame.startsWith('a')) {clearTimeout(timeout); resolve(JSON.parse(frame.slice(1)));}
        });
      });
      assert.deepEqual(received, ['synthetic echo']);
    } finally {socket?.terminate(); await new Promise((resolve) => httpServer.close(resolve));}
    console.log('Dependency compatibility checks passed: pooled workers, serializer safety, webpack copy/minification, local gRPC, query parsing, SockJS transport.');
  } finally {await fs.rm(dir, {recursive: true, force: true});}
}
main().catch((error) => {console.error(error); process.exitCode = 1;});
