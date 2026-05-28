import React from 'react';

export default function LEDWidget({ title, value, settings }) {
  const color     = settings.color     ?? '#22c55e';
  const offColor  = '#1e293b';
  const ledMode   = settings.ledMode   ?? settings.led_mode ?? 'binary';
  const threshold = settings.threshold ?? 0.5;

  // Compute brightness (0..1)
  let brightness;
  if (ledMode === 'pwm') {
    const pwmMin = settings.pwmMin ?? settings.pwm_min ?? 0;
    const pwmMax = settings.pwmMax ?? settings.pwm_max ?? 100;
    const v      = value !== undefined ? parseFloat(value) : 0;
    brightness = pwmMax > pwmMin
      ? Math.min(1, Math.max(0, (v - pwmMin) / (pwmMax - pwmMin)))
      : 0;
  } else {
    brightness = value !== undefined && parseFloat(value) >= threshold ? 1 : 0;
  }

  const on = brightness > 0.01;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}>
      {!settings.hide_title && !settings.hideTitle && (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{title}</div>
      )}

      {/* LED dome */}
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        {/* Outer glow — scales with brightness */}
        <div style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          background: on ? `radial-gradient(circle, ${color}${Math.round(brightness * 0x44).toString(16).padStart(2, '0')} 0%, transparent 70%)` : 'none',
          transition: 'all 0.3s ease',
        }} />
        {/* LED body */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          opacity: ledMode === 'pwm' ? 0.2 + brightness * 0.8 : 1,
          background: on
            ? `radial-gradient(circle at 35% 35%, #fff 0%, ${color} 40%, ${color}cc 100%)`
            : `radial-gradient(circle at 35% 35%, #475569 0%, ${offColor} 60%)`,
          boxShadow: on
            ? `0 0 ${Math.round(brightness * 18)}px ${color}, 0 0 ${Math.round(brightness * 36)}px ${color}88, inset 0 2px 4px rgba(255,255,255,.3)`
            : 'inset 0 2px 4px rgba(0,0,0,.4)',
          border: `2px solid ${on ? color : '#334155'}`,
          transition: 'all 0.25s ease',
        }} />
        {/* Specular highlight */}
        <div style={{
          position: 'absolute', top: 8, left: 10,
          width: 14, height: 10, borderRadius: '50%',
          background: 'rgba(255,255,255,0.35)',
          transform: 'rotate(-20deg)',
          opacity: brightness * 0.9,
          transition: 'opacity 0.25s',
        }} />
      </div>

      {/* Label */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', color: on ? color : '#475569', transition: 'color 0.25s' }}>
        {ledMode === 'pwm'
          ? `${Math.round(brightness * 100)}%`
          : (on ? 'ON' : 'OFF')
        }
      </div>
    </div>
  );
}
