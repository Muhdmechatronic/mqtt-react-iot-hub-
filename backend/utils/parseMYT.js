// Interprets a bare datetime-local string (no TZ suffix) as Malaysia Time (UTC+8).
// Strings that already carry a TZ offset or 'Z' are passed through unchanged.
function parseMYT(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('+') || dateStr.endsWith('Z')) return new Date(dateStr);
  return new Date(dateStr + '+08:00');
}

module.exports = parseMYT;
