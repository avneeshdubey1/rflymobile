const heartbeats = new Map();

function record(job, status = 'ok', details = {}) {
  const heartbeat = { job, status, checkedAt: new Date().toISOString(), ...details };
  heartbeats.set(job, heartbeat);
  return heartbeat;
}

function getAll() { return Array.from(heartbeats.values()); }

module.exports = { record, getAll };
