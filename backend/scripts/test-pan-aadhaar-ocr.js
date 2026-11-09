/**
 * Unit tests for the PAN + Aadhaar extraction logic in backend/services/panOcr.js.
 *
 * These validate the pure parsing/validation functions (no cloud credentials
 * and no network calls required). Run from the project root:
 *   node backend/scripts/test-pan-aadhaar-ocr.js
 */
const assert = require('assert');
const {
  parsePanText,
  parseAadhaarText,
  extractDob,
  extractFatherName,
  extractGender,
  verhoeff,
} = require('../services/panOcr');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    console.error('  \u2717 ' + name + ' -> ' + e.message);
    process.exitCode = 1;
  }
}

console.log('PAN extraction:');
test('parses PAN number, name, father, DOB', () => {
  const r = parsePanText(`
    INCOME TAX DEPARTMENT
    Permanent Account Number
    ABCDE1234F
    Name : RAHUL SHARMA
    Father's Name : SURESH SHARMA
    Date of Birth : 12/03/1994
  `);
  assert.strictEqual(r.pan, 'ABCDE1234F');
  assert.match(r.name, /RAHUL SHARMA/i);
  assert.match(r.father, /SURESH SHARMA/i);
  assert.strictEqual(r.dob, '1994-03-12');
});

test('rejects PAN embedded in a longer token', () => {
  const r = parsePanText('XYZABCDE1234FXYZ junk');
  assert.strictEqual(r.pan, '');
});

test('extractDob handles slash, dash, dot and 2-digit year', () => {
  assert.strictEqual(extractDob('15/08/1995'), '1995-08-15');
  assert.strictEqual(extractDob('1-2-96'), '1996-02-01');
  assert.strictEqual(extractDob('03.04.2001'), '2001-04-03');
  assert.strictEqual(extractDob('no date here'), '');
});

test('extractFatherName handles variants', () => {
  assert.match(extractFatherName("Father's Name : RAMESH"), /RAMESH/i);
  assert.match(extractFatherName('Father Name: RAMESH'), /RAMESH/i);
});

console.log('Aadhaar extraction:');
test('Verhoeff checksum accepts a valid number', () => {
  assert.strictEqual(verhoeff('100000000004'), true);
});

test('Verhoeff checksum rejects an invalid number', () => {
  assert.strictEqual(verhoeff('000000000000'), false);
});

test('parses Aadhaar number, name, dob, gender', () => {
  const r = parseAadhaarText(`
    AADHAAR
    1000 0000 0004
    Name : RAHUL KUMAR
    DOB : 15/08/1995
    Gender : MALE
  `);
  assert.strictEqual(r.documentType, 'AADHAAR');
  assert.strictEqual(r.aadhaarNumber, '100000000004');
  assert.strictEqual(r.aadhaarMask, 'XXXX XXXX 0004');
  assert.match(r.name, /RAHUL KUMAR/i);
  assert.strictEqual(r.dob, '1995-08-15');
  assert.strictEqual(r.gender, 'MALE');
});

test('parses gender variants', () => {
  assert.strictEqual(extractGender('Gender : FEMALE'), 'FEMALE');
  assert.strictEqual(extractGender('Gender : MALE'), 'MALE');
  assert.strictEqual(extractGender('no gender'), '');
});

console.log('');

if (process.exitCode) {
  console.error('FAILURES: at least one assertion failed');
} else {
  console.log('All ' + passed + ' tests passed');
}
