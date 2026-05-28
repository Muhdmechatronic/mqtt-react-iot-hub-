import React from 'react';
import { toMYT } from '../utils/time';

export default function LabelWidget({ title, value, settings, widget, lastEvent }) {
  const unit  = settings.unit  ?? '';
  const color = settings.color ?? '#38bdf8';

  const safeVal = value !== undefined ? parseFloat(value) : undefined;

  // Timestamp of the last update for this specific sensor
  let lastUpdated = null;
  if (
    lastEvent &&
    String(lastEvent.device_id) === String(widget?.device_id) &&
    widget?.data_key &&
    lastEvent.data?.[widget.data_key] !== undefined
  ) {
    lastUpdated = lastEvent.timestamp || null;
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:12 }}>
      <div style={{ fontSize:12, color:'#94a3b8', marginBottom:8 }}>{title}</div>

      <div style={{ fontSize:32, fontWeight:700, color, lineHeight:1 }}>
        {safeVal !== undefined ? safeVal.toFixed(2) : (value !== undefined ? value : '--')}
        <span style={{ fontSize:15, color:'#94a3b8', marginLeft:4 }}>{unit}</span>
      </div>

      {lastUpdated && (
        <div style={{ fontSize:10, color:'#475569', marginTop:10, textAlign:'center' }}>
          {toMYT(lastUpdated)}
        </div>
      )}
    </div>
  );
}
