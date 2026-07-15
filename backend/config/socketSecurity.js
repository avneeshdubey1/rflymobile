function isSocketOriginAllowed(origin, config) {
  if (!origin) return !config.isProduction;
  return config.allowedOrigins.includes(origin);
}

function createConnectionGate(config) {
  const attempts = new Map();
  return (request, callback) => {
    const origin = request.headers.origin;
    if (!isSocketOriginAllowed(origin, config)) return callback('Origin is not allowed', false);
    const now = Date.now();
    const forwarded = String(request.headers['x-forwarded-for'] || '').split(',').map((part) => part.trim()).filter(Boolean);
    const forwardedIndex = forwarded.length - config.trustProxyHops;
    const key = config.trustProxyHops > 0 && forwardedIndex >= 0 ? forwarded[forwardedIndex] : (request.socket.remoteAddress || 'unknown');
    if (attempts.size > 10_000) {
      for (const [address, timestamps] of attempts) {
        if (!timestamps.some((timestamp) => now - timestamp < config.socket.eventWindowMs)) attempts.delete(address);
      }
    }
    const current = (attempts.get(key) || []).filter((timestamp) => now - timestamp < config.socket.eventWindowMs);
    if (current.length >= config.socket.connectionMax) return callback('Connection rate limit exceeded', false);
    current.push(now);
    attempts.set(key, current);
    return callback(null, true);
  };
}

function createSocketServerOptions(config) {
  return {
    allowRequest: createConnectionGate(config),
    connectTimeout: 20_000,
    maxHttpBufferSize: config.socket.maxPayloadBytes,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    cors: {
      credentials: true,
      methods: ['GET', 'POST'],
      origin(origin, callback) {
        if (isSocketOriginAllowed(origin, config)) return callback(null, true);
        return callback(new Error('Origin is not allowed'));
      },
    },
  };
}

function installSocketEventProtection(io, config) {
  const supportedEvents = new Set(['chat:join', 'chat:send', 'chat:read', 'chat:close', 'location:watch', 'location:ping']);
  io.on('connection', (socket) => {
    let receivedAt = [];
    socket.use(([event, ...args], next) => {
      if (!supportedEvents.has(event)) return next(new Error('Unsupported socket event'));
      let bytes;
      try { bytes = Buffer.byteLength(JSON.stringify(args)); } catch { return next(new Error('Socket payload must be serializable')); }
      if (bytes > config.socket.maxPayloadBytes) return next(new Error('Socket payload is too large'));
      const now = Date.now();
      receivedAt = receivedAt.filter((timestamp) => now - timestamp < config.socket.eventWindowMs);
      if (receivedAt.length >= config.socket.eventMax) return next(new Error('Socket event rate limit exceeded'));
      receivedAt.push(now);
      return next();
    });
  });
}

module.exports = { createConnectionGate, createSocketServerOptions, installSocketEventProtection, isSocketOriginAllowed };
