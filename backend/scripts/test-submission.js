/**
 * End-to-end submission test for POST /api/applications.
 *
 * Starts the real backend on an ephemeral port with the actual MONGODB_URI
 * from backend/.env, waits for /api/health, POSTs a valid application, verifies
 * the server accepts it (ok:true, assigned ref), then cleans up the test doc.
 *
 * Run from the project root:
 *   node backend/scripts/test-submission.js
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3999;
const BACKEND_DIR = path.join(__dirname, '..');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  let server;
  try {
    server = spawn(process.execPath, ['server.js'], {
      cwd: BACKEND_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', d => process.stdout.write('[server] ' + d));
    server.stderr.on('data', d => process.stderr.write('[server-err] ' + d));
  } catch (e) {
    console.error('Failed to spawn backend:', e.message);
    process.exit(1);
  }

  // Wait for health endpoint.
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await sleep(500);
    try {
      const h = await fetch(`http://localhost:${PORT}/api/health`);
      if (h.ok) up = true;
    } catch (e) { /* not yet */ }
  }
  if (!up) {
    console.error('FAIL: backend did not become healthy in time');
    server.kill();
    process.exit(1);
  }

  const rec = {
    Name: 'Test User',
    Mobile: '9876543210',
    Email: '',
    City: 'Mumbai',
    loanType: 'Medical emergency',
    LoanType: 'Medical emergency',
    Amount: 200000,
    Tenure: 12,
    Income: 50000,
    employer: 'Acme',
    employmentType: 'Salaried',
    source: 'full',
    consent: true,
  };

  let status, body;
  try {
    const r = await fetch(`http://localhost:${PORT}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
    status = r.status;
    body = await r.json();
  } catch (e) {
    console.error('FAIL: request error:', e.message);
    server.kill();
    process.exit(1);
  }

  console.log('HTTP status:', status);
  console.log('Response body:', JSON.stringify(body));

  if (status !== 200 || !body.ok) {
    console.error('FAIL: submission was not accepted');
    server.kill();
    process.exit(1);
  }
  if (!body.ref) {
    console.error('FAIL: no loan reference returned');
    server.kill();
    process.exit(1);
  }

  console.log('PASS: submission saved, ref =', body.ref);

  // Clean up the test document.
  try {
    const mongoose = require('mongoose');
    require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') });
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const { Application } = require('../models');
    const del = await Application.deleteOne({ ref: body.ref });
    console.log('Cleanup: removed test doc:', del.deletedCount, 'deleted');
    await mongoose.disconnect();
  } catch (e) {
    console.warn('Note: cleanup skipped:', e.message);
  }

  server.kill();
  process.exit(0);
})();
