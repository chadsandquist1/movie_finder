const subscribers = new Set();
let logs = [];

function serialize(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value instanceof Uint8Array) {
      return new TextDecoder().decode(value);
    }
    return value;
  }, 2);
}

function notify() {
  const snapshot = [...logs];
  subscribers.forEach((cb) => cb(snapshot));
}

export function subscribe(callback) {
  subscribers.add(callback);
  callback([...logs]);
  return () => subscribers.delete(callback);
}

export function clearLogs() {
  logs = [];
  notify();
}

export async function loggedSend(client, command) {
  const method = command.constructor.name;
  const input = { ...command.input };
  // Redact sensitive fields
  if (input.Password) input.Password = '***';
  if (input.AuthParameters?.PASSWORD) {
    input.AuthParameters = { ...input.AuthParameters, PASSWORD: '***' };
  }

  const entry = {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    method,
    input: serialize(input),
    output: null,
    error: null,
    durationMs: null,
    success: null,
  };

  logs = [...logs, entry];
  notify();

  const start = performance.now();
  try {
    const result = await client.send(command);
    entry.durationMs = Math.round(performance.now() - start);
    entry.output = serialize(result);
    entry.success = true;
    logs = [...logs]; // trigger new ref
    notify();
    return result;
  } catch (err) {
    entry.durationMs = Math.round(performance.now() - start);
    entry.error = err.message || String(err);
    entry.success = false;
    logs = [...logs];
    notify();
    throw err;
  }
}
