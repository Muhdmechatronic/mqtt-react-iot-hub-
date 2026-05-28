const MYT = { timeZone: 'Asia/Kuala_Lumpur' };

export function toMYT(ts) {
  return new Date(ts).toLocaleString('en-MY', { ...MYT, hour12: false });
}

export function toMYTTime(ts) {
  return new Date(ts).toLocaleTimeString('en-MY', { ...MYT, hour12: false });
}

export function toMYTDate(ts) {
  return new Date(ts).toLocaleDateString('en-MY', MYT);
}
