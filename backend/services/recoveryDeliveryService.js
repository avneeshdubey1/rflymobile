let testAdapter;
const pendingJobs = new Set();

function setTestAdapter(adapter) {
  if (String(process.env.NODE_ENV).toLowerCase() !== 'test') {
    throw new Error('The recovery delivery test adapter is available only in tests');
  }
  testAdapter = adapter;
}

function clearTestAdapter() {
  testAdapter = undefined;
}

async function deliver(message) {
  if (testAdapter) return testAdapter(message);
  // Provider integration is intentionally fail-closed. The request endpoint
  // remains generic, but no recovery code is logged or returned to callers.
  return { status: 'UNAVAILABLE' };
}

function enqueue(work) {
  let job;
  job = new Promise((resolve) => setImmediate(resolve))
    .then(work)
    .catch((error) => {
      // Never include the job payload: it contains the recovery code and
      // destination. Provider/repository failures remain generic externally.
      console.error('Recovery delivery job failed', { error: error.name, code: error.code });
    })
    .finally(() => pendingJobs.delete(job));
  pendingJobs.add(job);
}

async function waitForIdleForTests() {
  if (String(process.env.NODE_ENV).toLowerCase() !== 'test') {
    throw new Error('Recovery delivery queue inspection is available only in tests');
  }
  await Promise.all([...pendingJobs]);
}

module.exports = {
  clearTestAdapter,
  deliver,
  enqueue,
  setTestAdapter,
  waitForIdleForTests,
};
