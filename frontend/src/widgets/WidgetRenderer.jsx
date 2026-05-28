import React from 'react';
import GaugeWidget       from './GaugeWidget';
import LineChartWidget   from './LineChartWidget';
import ButtonWidget      from './ButtonWidget';
import SwitchWidget      from './SwitchWidget';
import SliderWidget      from './SliderWidget';
import LabelWidget       from './LabelWidget';
import LEDWidget         from './LEDWidget';
import ProgressBarWidget from './ProgressBarWidget';
import StatusWidget      from './StatusWidget';

export default function WidgetRenderer({ widget, sensorData, lastEvent, onCommand }) {
  const settings = widget.settings_json || {};
  const value    = sensorData?.[widget.data_key];

  switch (widget.type) {
    case 'gauge':
      return <GaugeWidget title={widget.title} value={value} settings={settings} />;

    case 'linechart':
      return (
        <LineChartWidget
          title={widget.title}
          deviceId={widget.device_id}
          dataKey={widget.data_key}
          settings={settings}
          lastEvent={lastEvent}
        />
      );

    case 'label':
      return (
        <LabelWidget
          title={widget.title}
          value={value}
          settings={settings}
          widget={widget}
          lastEvent={lastEvent}
        />
      );

    case 'button':
      return <ButtonWidget title={widget.title} value={value} widget={widget} onCommand={onCommand} settings={settings} />;

    case 'switch':
      return <SwitchWidget title={widget.title} value={value} widget={widget} onCommand={onCommand} settings={settings} />;

    case 'slider':
      return <SliderWidget title={widget.title} value={value} widget={widget} onCommand={onCommand} settings={settings} />;

    case 'led':
      return <LEDWidget title={widget.title} value={value} settings={settings} />;

    case 'progressbar':
      return <ProgressBarWidget title={widget.title} value={value} settings={settings} />;

    case 'status':
      return <StatusWidget title={widget.title} value={value} settings={settings} />;

    default:
      return (
        <div style={{ padding: 12, color: '#64748b', fontSize: 12 }}>
          Unknown type: {widget.type}
        </div>
      );
  }
}
