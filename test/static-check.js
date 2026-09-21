const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');

const required = [
  'index.html', 'README.md', '.gitignore',
  'css/style.css',
  'js/genome.js', 'js/memory.js', 'js/room.js', 'js/thinker.js', 'js/app.js'
];

for (const f of required) {
  const p = path.join(BASE, f);
  if (!fs.existsSync(p)) throw new Error(`MISSING: ${f} (${p})`);
  console.log(`✓ ${f}`);
}

const html = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
const expectedScripts = ['js/genome.js', 'js/memory.js', 'js/room.js', 'js/thinker.js', 'js/app.js'];
for (const s of expectedScripts) {
  if (!html.includes(s)) throw new Error(`HTML MISSING SCRIPT: ${s}`);
}
if (!html.includes('js.puter.com')) throw new Error('HTML MISSING puter.js CDN');
console.log('✓ index.html has all script refs + puter.js CDN');

for (const f of required.filter(f => f.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(BASE, f), 'utf8');
  try {
    new Function(code);
    console.log(`✓ ${f} parses`);
  } catch (e) {
    throw new Error(`SYNTAX ERROR in ${f}: ${e.message}`);
  }
}

const genomeCode = fs.readFileSync(path.join(BASE, 'js/genome.js'), 'utf8');
if (!genomeCode.includes('generateGenome')) throw new Error('genome.js missing generateGenome');
if (!genomeCode.includes('randomMood')) throw new Error('genome.js missing randomMood');
console.log('✓ genome.js exports verified');

const memCode = fs.readFileSync(path.join(BASE, 'js/memory.js'), 'utf8');
if (!memCode.includes('class MemoryStream')) throw new Error('memory.js missing MemoryStream');
console.log('✓ memory.js exports verified');

const thinkerCode = fs.readFileSync(path.join(BASE, 'js/thinker.js'), 'utf8');
const tools = ['write_file', 'read_file', 'list_files', 'search_web', 'fetch_url', 'move', 'respond'];
for (const t of tools) {
  if (!thinkerCode.includes(`"${t}"`)) throw new Error(`thinker.js missing tool: ${t}`);
}
if (!thinkerCode.includes('class Thinker')) throw new Error('thinker.js missing Thinker class');
if (!thinkerCode.includes('class Workspace')) throw new Error('thinker.js missing Workspace class');
console.log('✓ thinker.js has all tools + classes');

const roomCode = fs.readFileSync(path.join(BASE, 'js/room.js'), 'utf8');
if (!roomCode.includes('class RoomRenderer')) throw new Error('room.js missing RoomRenderer');
console.log('✓ room.js exports verified');

const appCode = fs.readFileSync(path.join(BASE, 'js/app.js'), 'utf8');
const globals = ['DrifterGenome', 'DrifterMemory', 'DrifterRoom', 'DrifterThinker'];
for (const g of globals) {
  if (!appCode.includes(g)) throw new Error(`app.js missing window.${g}`);
}
console.log('✓ app.js references all window globals');

console.log('\n--- All static tests passed ---');
