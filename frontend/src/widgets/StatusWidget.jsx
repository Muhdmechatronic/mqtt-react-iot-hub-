import React from 'react';

export default function StatusWidget({ title, value, settings }) {
  const isOn = Boolean(value);
  const colorOn  = settings.colorOn  ?? '#4ade80';
  const colorOff = settings.colorOff ?? '#f87171';
  const labelOn  = settings.labelOn  ?? 'Active';
  const labelOff = settings.labelOff ?? 'Inactive';

  return (
    <div style={{ padding:12, textAlign:'center' }}>
      <div style={{ fontSize:13, color:'#94a3b8', marginBottom:10 }}>{title}</div>
      <div style={{
        width:16, height:16, borderRadius:'50%',
        background: isOn ? colorOn : colorOff,
        margin:'0 auto 8px',
        boxShadow: `0 0 8px ${isOn ? colorOn : colorOff}`,
      }} />
      <div style={{ fontSize:13, color: isOn ? colorOn : colorOff, fontWeight:600 }}>
        {isOn ? labelOn : labelOff}
      </div>
    </div>
  );
}
