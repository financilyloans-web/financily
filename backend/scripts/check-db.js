// MongoDB connectivity diagnostic for the Financily backend.
// Usage: npm run db:check
//
// Reads MONGODB_URI from backend/.env (or the environment), attempts a real
// MongoDB connection, and reports a clear verdict. Exit code 0 = connected,
// 1 = failed (with the underlying reason: bad auth, DNS, network, etc.).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set (backend/.env or environment).');
    process.exit(1);
  }

  const host = uri.split('@')[1] ? uri.split('@')[1].split('/')[0] : '(no host)';
  const username = uri.match(/^mongodb\+srv:\/\/([^:]+):/) || uri.match(/^mongodb:\/\/([^:]+):/);
  console.log('Host:     ' + host);
  console.log('Username: ' + (username ? username[1] : '(none)'));
  console.log('Attempting connection (12s timeout)...');

  const start = Date.now();

  // Hard watchdog: never let this diagnostic hang (DNS/driver stalls).
  const watchdog = setTimeout(() => {
    console.error('FAILED: connection stalled (no response within 18s) — likely DNS/SRV resolution hang. Verify the host spelling in MONGODB_URI.');
    process.exit(1);
  }, 18000);
  watchdog.unref();

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000, family: 4 });
    clearTimeout(watchdog);
    console.log('CONNECTED OK in ' + (Date.now() - start) + 'ms');
    const dbs = await mongoose.connection.db.admin().listDatabases();
    console.log('Databases: ' + dbs.databases.map(d => d.name).join(', '));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    const ms = Date.now() - start;
    const msg = e.message || String(e);
    if (/bad auth|Authentication failed|auth/i.test(msg)) {
      console.error('FAILED in ' + ms + 'ms: AUTHENTICATION FAILED — the database user/credentials in MONGODB_URI are rejected by Atlas. Check Database Access in the Atlas console (user exists, password matches, read/write on the database).');
    } else if (/ENOTFOUND|EAI_AGAIN|queryA|querySrv|SRV|Could not find any servers/i.test(msg)) {
      console.error('FAILED in ' + ms + 'ms: DNS/RESOLUTION ERROR — the cluster host could not be resolved. Verify the host in MONGODB_URI.');
    } else if (/ECONNREFUSED|ETIMEDOUT|ENETUNREACH|timed out/i.test(msg)) {
      console.error('FAILED in ' + ms + 'ms: NETWORK UNREACHABLE — cannot reach the cluster. Check Atlas Network Access (0.0.0.0/0 or your IP) and that the host:port is correct.');
    } else {
      console.error('FAILED in ' + ms + 'ms: ' + msg);
    }
    process.exit(1);
  }
})();
