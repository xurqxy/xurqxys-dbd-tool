'use strict';
// Obfuscates JavaScript for release builds so the shipped code is hard to read and modify.
// Settings are picked to keep the app fast: no control-flow flattening or dead code, which slow down the hot paths
// (spin animation, embers) and make antivirus scanners suspicious.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const JavaScriptObfuscator = require('javascript-obfuscator');

const BASE = {
  compact: true,
  simplify: true,
  // Hexadecimal names (_0x1f3a…) can never equal a real name in the code. Short random names once renamed a local
  // variable to "t", hiding the global translation function t() and breaking the page in some builds.
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: false, // true breaks some functions together with the wrappers below
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'function',
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  selfDefending: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
  // Top-level names stay as they are: the renderer's classic scripts share globals across files.
  renameGlobals: false,
};

// The renderer's classic scripts share one global scope: names declared at the top of one file (t, S, $, esc…) are
// used in the others. The obfuscator can't see across files, so every such name is reserved: no local variable may
// be renamed to it. Plus the platform globals both kinds of code rely on.
const PLATFORM_GLOBALS = ['window', 'document', 'navigator', 'location', 'console', 'require', 'module', 'exports',
  'process', 'Buffer', '__dirname', '__filename', 'globalThis', 'self'];
let sharedGlobals = null;
function rendererGlobals() {
  if (sharedGlobals) return sharedGlobals;
  const dir = path.join(__dirname, '..', 'src');
  const names = new Set(PLATFORM_GLOBALS);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const ast = acorn.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' });
    for (const node of ast.body) {
      if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') names.add(node.id.name);
      if (node.type === 'VariableDeclaration') for (const d of node.declarations) if (d.id.type === 'Identifier') names.add(d.id.name);
    }
  }
  sharedGlobals = [...names];
  return sharedGlobals;
}
// reservedNames takes regular expressions; match each name exactly.
const exact = (names) => names.map((n) => `^${n.split('$').join('\\$')}$`);

// renderer: browser scripts (src/*.js); otherwise Node/Electron main-process code.
// prefix: the obfuscator adds its own top-level helpers; renderer scripts share one global scope,
// so every file needs different helper names or they overwrite each other.
function obfuscateCode(code, { renderer = false, prefix = '' } = {}) {
  return JavaScriptObfuscator.obfuscate(code, {
    ...BASE,
    target: renderer ? 'browser' : 'node',
    identifiersPrefix: prefix,
    reservedNames: exact(renderer ? rendererGlobals() : PLATFORM_GLOBALS),
  }).getObfuscatedCode();
}

let fileCount = 0;
function obfuscateFile(file, options = {}) {
  const code = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, obfuscateCode(code, { prefix: `_${(fileCount++).toString(36)}`, ...options }));
}

module.exports = { obfuscateCode, obfuscateFile };
