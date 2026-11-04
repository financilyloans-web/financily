// Verification for the loan-application KYC extraction + step navigation.
// Run: npm run verify --prefix frontend
//
// This reads the real source (frontend/application.html) and checks:
//   1. The PAN and Aadhaar field containers each contain an .err element
//      (fix for the "Continue button not working" regression).
//   2. The PAN/Aadhaar handlers no longer call the throwing
//      querySelector('.err').textContent pattern (they use errEl()).
//   3. The real parseDob() (extracted from the source) parses and validates
//      DOB strings correctly.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'application.html'), 'utf8');

let failures = 0;
function check(cond, name){
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!cond) failures++;
}

// ---- 1. Structural: .err present in pan/aad fields ----
function blockBetween(openId, closeAfter){
  const a = html.indexOf('id="' + openId + '"');
  if (a === -1) return '';
  const b = html.indexOf(closeAfter, a);
  return b === -1 ? html.slice(a) : html.slice(a, b);
}
const panBlock = blockBetween('panFields', 'class="btnnav"');
const aadBlock = blockBetween('aadFields', 'class="btnnav"');
check(/<div class="err"><\/div>/.test(panBlock), '#panFields contains an .err element');
check(/<div class="err"><\/div>/.test(aadBlock), '#aadFields contains an .err element');

// ---- 2. Handlers avoid the throwing pattern, use errEl ----
const barePatterns = [
  /$\(\'panFields'\)\.querySelector\('\.err'\)/,
  /$\(\'aadFields'\)\.querySelector\('\.err'\)/
];
check(!barePatterns.some(re => re.test(html)), 'no bare querySelector(\'.err\') on pan/aad fields');
const errElUses = (html.match(/errEl\(\$\('panFields'\)\)|errEl\(\$\('aadFields'\)\)/g) || []).length;
check(errElUses === 4, 'PAN/Aadhaar handlers use errEl() (4/4)');

// ---- 3. Real parseDob() behavior ----
const fnStart = html.indexOf('function parseDob(text){');
const fnOpen = html.indexOf('{', fnStart);
const fnClose = html.indexOf('\n}', fnOpen);
const fnSrc = html.slice(fnStart, fnClose + 2); // "function parseDob(text){...}"
const parseDob = new Function('return (' + fnSrc + ')')();

const dobCases = [
  ['DOB : 12/03/1994', '1994-03-12'],
  ['12-03-1994', '1994-03-12'],
  ['12.03.1994', '1994-03-12'],
  ['Date of Birth 12 03 1994', '1994-03-12'],
  ['05/09/1988', '1988-09-05'],
  ['12/03/94', '1994-03-12'],
  ['08/11/72', '1972-11-08'],
  ['29/02/2000', '2000-02-29'],
  ['29/02/2001', ''],
  ['31/02/2020', ''],
  ['13/13/2000', ''],
  ['00/05/2000', ''],
  ['99/99/9999', ''],
  ['9876543210', ''],
  ['400001', ''],
  ['4866', ''],
  ['The date is 25/12/2023 here', '2023-12-25'],
  ['Mixed 17/05/2024 year', '2024-05-17']
];
for (const [inp, want] of dobCases){
  check(parseDob(inp) === want, 'parseDob(' + JSON.stringify(inp) + ') -> ' + JSON.stringify(parseDob(inp)) + ' (want ' + JSON.stringify(want) + ')');
}

console.log('\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
