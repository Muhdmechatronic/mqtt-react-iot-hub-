// Type normalization — single source of truth for pin value coercion.
// All ingestion paths (MQTT, WebSocket, REST) call coerceValue before
// touching the state cache or re-broadcasting.

function coerceValue(raw, valueType) {
  if (valueType === 'integer') return Math.trunc(Number(raw));
  if (valueType === 'double')  return parseFloat(raw);
  return String(raw ?? '');
}

// Infer valueType from a native JS value when the sender omits it.
// Hardware using ArduinoJson sends native types so this works correctly.
function inferValueType(raw) {
  if (typeof raw === 'string') return 'string';
  if (!Number.isFinite(raw))   return 'string';
  return Number.isInteger(raw) ? 'integer' : 'double';
}

module.exports = { coerceValue, inferValueType };
