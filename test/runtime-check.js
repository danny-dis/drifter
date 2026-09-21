// Node-compatible E2E test with full browser mocks
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = path.resolve(__dirname, '..');

// ── Mocks ──────────────────────────────────────────────────────────
const store = {};
const localStorageMock = {
  getItem: k => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

let puterCallCount = 0;
const puterMock = {
  ai: {
    chat: async (messages, opts) => {
      puterCallCount++;
      return "Hi! I'm thinking about the nature of existence.";
    },
    embed: async (text) => {
      return Array.from({ length: 32 }, (_, i) => ((text.charCodeAt(i % text.length) || 65) - 65) / 26);
    }
  }
};

// Shared sandbox (like a browser window)
const sandbox = {
  console,
  TextEncoder,
  TextDecoder,
  crypto: {
    subtle: {
      digest: async (algo, buf) => {
        const arr = new Uint8Array(buf);
        const hash = new Uint8Array(64);
        for (let i = 0; i < arr.length; i++) hash[i % 64] ^= arr[i];
        for (let i = 0; i < 64; i++) hash[i] = (hash[i] * 2654435761) >>> 0;
        return hash.buffer;
      }
    }
  },
  localStorage: localStorageMock,
  puter: puterMock,
  module: { exports: {} },
  exports: {}
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

function loadScript(file) {
  const code = fs.readFileSync(path.join(BASE, file), 'utf8');
  vm.runInContext(code, sandbox);
}

// ── Load modules (shared scope) ─────────────────────────────────────
loadScript('js/genome.js');
loadScript('js/memory.js');
loadScript('js/thinker.js');

const generateGenome = sandbox.DrifterGenome.generateGenome;
const randomMood = sandbox.DrifterGenome.randomMood;
const MemoryStream = sandbox.DrifterMemory.MemoryStream;
const Thinker = sandbox.DrifterThinker.Thinker;
const Workspace = sandbox.DrifterThinker.Workspace;

// ── Test runner ─────────────────────────────────────────────────────
let pass = 0, fail = 0;

function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

async function test(name, fn) {
  try { await fn(); ok(name, true); }
  catch (e) { ok(name, false, e.message); }
}

async function runTests() {
  console.log('\n--- Genome ---');
  await test('generates 3 domains', async () => {
    const g = await generateGenome('Coral', 'entropy123');
    assert(g.traits.domains.length === 3, 'domains count');
  });

  await test('generates 2 styles', async () => {
    const g = await generateGenome('Pippin', 'more entropy');
    assert(g.traits.thinking_styles.length === 2, 'styles count');
  });

  await test('is deterministic', async () => {
    const a = await generateGenome('Coral', 'xyz');
    const b = await generateGenome('Coral', 'xyz');
    assert(a.hash === b.hash, 'same hash');
  });

  await test('varies with entropy', async () => {
    const a = await generateGenome('Coral', 'abc');
    const b = await generateGenome('Coral', 'def');
    assert(a.hash !== b.hash, 'different hashes');
  });

  await test('has animal', async () => {
    const g = await generateGenome('Coral', 'xyz');
    assert(!!g.animal, 'animal exists');
  });

  console.log('\n--- Mood ---');
  await test('randomMood valid', () => {
    const m = randomMood();
    assert(m.label && m.nudge, 'mood fields');
  });

  console.log('\n--- Memory ---');
  await test('adds memories', async () => {
    localStorageMock.clear();
    const mem = new MemoryStream('test');
    await mem.add('I love primes');
    await mem.add('Weather is nice');
    assert(mem.size === 2, `size ${mem.size}`);
    assert(mem.importanceSum > 0, 'importance sum');
  });

  await test('persists to localStorage', async () => {
    localStorageMock.clear();
    const mem = new MemoryStream('persist');
    await mem.add('persistence test');
    const raw = localStorageMock.getItem('drifter_memories_persist');
    assert(raw !== null, 'data in storage');
  });

  await test('retrieves by relevance', async () => {
    localStorageMock.clear();
    const mem = new MemoryStream('relevance');
    await mem.add('quantum physics entanglement');
    await mem.add('grocery shopping milk eggs');
    const results = await mem.retrieve('physics quantum');
    assert(results.length > 0, 'got results');
  });

  await test('shouldReflect triggers', async () => {
    localStorageMock.clear();
    const mem = new MemoryStream('reflect');
    assert(!mem.shouldReflect(1), 'should not reflect at 1');
    mem.importanceSum = 100;
    assert(mem.shouldReflect(50), 'should reflect at 50');
    mem.resetImportanceSum();
    assert(mem.importanceSum === 0, 'sum reset');
  });

  console.log('\n--- Workspace ---');
  await test('write and read file', () => {
    const ws = new Workspace('test');
    ws.writeFile('test.md', '# Hello');
    assert(ws.readFile('test.md') === '# Hello', 'content');
  });

  await test('list files sorted', () => {
    const ws = new Workspace('test');
    ws.writeFile('b.md', 'b');
    ws.writeFile('a.md', 'a');
    const files = ws.listFiles();
    assert(files.indexOf('a.md') < files.indexOf('b.md'), 'sorted');
  });

  await test('read missing file', () => {
    const ws = new Workspace('test_missing');
    const result = ws.readFile('nope.md');
    assert(result.includes('not found'), 'error message');
  });

  console.log('\n--- Thinker ---');
  await test('constructs', () => {
    localStorageMock.clear();
    const genome = { name: 'T', traits: { temperament: 'test', thinking_styles: ['x'], domains: ['y'] } };
    const mem = new MemoryStream('thinker');
    const room = { moveTo: () => {}, setActivity: () => {}, showBubble: () => {} };
    const t = new Thinker(genome, mem, room, { onEvent: () => {} });
    assert(t, 'thinker exists');
    assert(t.workspace, 'workspace exists');
    assert(t.model === 'gpt-5.4-nano', 'default model');
  });

  await test('full think cycle', async () => {
    localStorageMock.clear();
    puterCallCount = 0;
    const genome = { name: 'CycleBot', traits: { temperament: 'test', thinking_styles: ['a'], domains: ['b'] } };
    const mem = new MemoryStream('cycle');
    let events = [];
    const room = { moveTo: () => {}, setActivity: () => {}, showBubble: () => {}, position: { x: 5, y: 5 } };
    const t = new Thinker(genome, mem, room, { onEvent: e => events.push(e) });
    await t._thinkCycle();
    assert(puterCallCount > 0, 'puter called');
    assert(events.length > 0, 'events emitted');
    assert(mem.size > 0, 'memory stored');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

runTests().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
