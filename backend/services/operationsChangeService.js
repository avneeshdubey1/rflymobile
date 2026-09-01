function publishOperationsChange(req, resource) {
  // Controllers are also invoked directly by a few repository-level tests and
  // administrative scripts. Realtime refresh is best-effort and must never
  // turn a successful database mutation into an HTTP 500 when no Socket.IO
  // server is attached to the request.
  const io = req?.app?.get?.('io');
  if (!io) return;
  io.emit('operations:data-changed', {
    resource,
    changedAt: new Date().toISOString(),
  });
}

module.exports = { publishOperationsChange };
