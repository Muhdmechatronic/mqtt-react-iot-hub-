import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, X, Check, AlertCircle, Settings, ArrowLeft,
  Plus, Trash2, Zap, Volume2, Loader2, RefreshCw,
} from 'lucide-react';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ── Globals ───────────────────────────────────────────────────────────────────
const STORE_KEY = 'iot:voice_v2';

const WAVE_CSS = `@keyframes voiceBar {
  0%   { transform: scaleY(0.15); }
  100% { transform: scaleY(1);    }
}`;

// ── Storage ───────────────────────────────────────────────────────────────────
function loadStore()  { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; } }
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

// ── TTS (language-aware) ─────────────────────────────────────────────────────
function speak(text, lang = 'en-US') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang   = lang;
  u.rate   = 1.05; u.pitch = 1.0; u.volume = 0.85;
  window.speechSynthesis.speak(u);
}

// Localised response strings
const TTS_STRINGS = {
  'en-US': {
    macro:      n     => `Activating ${n}`,
    alreadyOn:  list  => `${list} is already on`,
    alreadyOff: list  => `${list} is already off`,
    turnOn:     names => `Turning on ${names}`,
    turnOff:    names => `Turning off ${names}`,
    increase:   names => `Increasing ${names}`,
    decrease:   names => `Decreasing ${names}`,
    setTo:     (n, v) => `Setting ${n} to ${v} percent`,
    noMatch:   ()     => 'No matching widget found',
    specify:   ()     => 'Please specify the action',
  },
  'ms-MY': {
    macro:      n     => `Mengaktifkan ${n}`,
    alreadyOn:  list  => `${list} sudah hidup`,
    alreadyOff: list  => `${list} sudah mati`,
    turnOn:     names => `Hidupkan ${names}`,
    turnOff:    names => `Matikan ${names}`,
    increase:   names => `Tingkatkan ${names}`,
    decrease:   names => `Kurangkan ${names}`,
    setTo:     (n, v) => `${n} ditetapkan kepada ${v} peratus`,
    noMatch:   ()     => 'Tiada peranti yang sepadan',
    specify:   ()     => 'Sila nyatakan tindakan',
  },
  'zh-CN': {
    macro:      n     => `激活 ${n}`,
    alreadyOn:  list  => `${list} 已经开启`,
    alreadyOff: list  => `${list} 已经关闭`,
    turnOn:     names => `开启 ${names}`,
    turnOff:    names => `关闭 ${names}`,
    increase:   names => `增强 ${names}`,
    decrease:   names => `降低 ${names}`,
    setTo:     (n, v) => `将 ${n} 设置为 ${v}`,
    noMatch:   ()     => '未找到匹配的设备',
    specify:   ()     => '请指定操作',
  },
};
function getTTS(lang) { return TTS_STRINGS[lang] || TTS_STRINGS['en-US']; }

// ── Multilingual normalisation ─────────────────────────────────────────────────
// Convert Malay / Chinese → English tokens BEFORE intent detection.
// Order is critical: replace numbers before stripping device glyphs (so 灯二 → led2).
const LANG_NORM = [
  // ── Malay actions ──
  [/\b(hidupkan|nyalakan|aktifkan|pasang|onkan)\b/gi,        'turn on'],
  [/\b(matikan|padamkan|tutup|offkan|padam|mematikan)\b/gi,  'turn off'],
  [/\b(naikkan|tingkatkan|besarkan|cerahkan|lajukan)\b/gi,   'increase'],
  [/\b(turunkan|kurangkan|kecilkan|redupkan|perlahan)\b/gi,  'decrease'],
  // ── Malay device nouns ──
  [/\b(kipas)\b/gi,               'fan'],
  [/\b(lampu|cahaya|mentol)\b/gi, 'led'],
  [/\b(suis|swich)\b/gi,          'switch'],
  // ── Malay connectors / quantifiers ──
  [/\b(dan|serta|dengan)\b/gi,    'and'],
  [/\b(semua|setiap|kesemua)\b/gi,'all'],
  // ── Malay ordinal words → digits ──
  [/\bsatu\b/gi,'1'],[/\bdua\b/gi,'2'],[/\btiga\b/gi,'3'],
  [/\bempat\b/gi,'4'],[/\blima\b/gi,'5'],[/\benam\b/gi,'6'],

  // ── Chinese actions ──
  [/打开|开启|开灯|启动/g,         ' turn on '],
  [/关闭|关灯|熄灭|停止|关掉/g,    ' turn off '],
  [/增加|提高|调高|加强/g,         ' increase '],
  [/减少|降低|调低|减弱/g,         ' decrease '],
  // ── Chinese device nouns ──
  [/风扇/g,      'fan'],
  [/灯光|照明/g, 'led'],
  [/开关/g,      'switch'],
  // ── Chinese cardinal numbers → digits (BEFORE stripping 灯) ──
  [/一/g,'1'],[/二|两/g,'2'],[/三/g,'3'],[/四/g,'4'],[/五/g,'5'],
  // ── Chinese 灯 → led (after number replacement) ──
  [/灯/g, 'led'],
  // ── Chinese connectors ──
  [/[和与]/g,    ' and '],
  [/所有|全部/g, 'all'],
];

// Spoken-form aliases → normalised (applied after LANG_NORM so English is guaranteed)
const ALIAS_NORM = [
  [/\bled\s*two\b/gi,   'led2'], [/\bled\s*one\b/gi,   'led1'],
  [/\bled\s*three\b/gi, 'led3'], [/\bled\s*four\b/gi,  'led4'],
  [/\bled\s*five\b/gi,  'led5'], [/\bled\s+(\d+)\b/gi, 'led$1'],
  [/\blight\s*two\b/gi,   'light2'], [/\blight\s*one\b/gi,   'light1'],
  [/\blight\s*three\b/gi, 'light3'], [/\blight\s+(\d+)\b/gi, 'light$1'],
  [/\bfan\s*one\b/gi,  'fan1'], [/\bfan\s*two\b/gi,  'fan2'],
  [/\bfan\s+(\d+)\b/gi,'fan$1'],
];

// Normalise a stored widget label the same way spoken text is normalised
// so "LED 2" → "led2" and matches the post-ALIAS_NORM transcript "led2".
function normalizeLabel(label) {
  let t = label.toLowerCase().trim();
  for (const [pat, rep] of ALIAS_NORM) t = t.replace(pat, rep);
  return t.replace(/\s+/g, ' ').trim();
}

// Whole-token test — prevents "led" from matching inside "led2" or "led1".
function hasToken(str, token) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w])${esc}(?![\\w])`, 'i').test(str);
}

function buildCustomRE(words) {
  if (!words?.length) return null;
  const esc = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${esc.join('|')})\\b`, 'gi');
}

function normalizeText(raw, customAliases = {}) {
  let t = raw.toLowerCase();
  // User-defined custom words take priority
  const reOn  = buildCustomRE(customAliases.on);
  const reOff = buildCustomRE(customAliases.off);
  if (reOn)  t = t.replace(reOn,  'turn on');
  if (reOff) t = t.replace(reOff, 'turn off');
  for (const [pat, rep] of LANG_NORM)  t = t.replace(pat, rep);
  for (const [pat, rep] of ALIAS_NORM) t = t.replace(pat, rep);
  return t.replace(/\s+/g, ' ').trim();
}

// ── Intent patterns ───────────────────────────────────────────────────────────
const ON_RE  = /\b(turn on|switch on|power on|enable|activate|start|open)\b/;
const OFF_RE = /\b(turn off|switch off|power off|disable|deactivate|stop|close)\b/;
const INC_RE = /\b(increase|brighter|faster|higher|louder|more|boost)\b/;
const DEC_RE = /\b(decrease|dimmer|slower|lower|quieter|less|reduce)\b/;
const PCT_RE = /(\d{1,3})\s*(%|percent)/;
const NUM_RE = /\b(\d{1,3})\b/;
const ALL_LIGHTS_RE = /\b(all lights?|all lamps?|every light|all bulbs?|all leds?)\b/;
const ALL_SW_RE     = /\b(everything|all devices?|all)\b/;
const STEP = 20;

function extractValue(t) {
  const pct = t.match(PCT_RE);
  if (pct) return Math.min(100, Math.max(0, parseInt(pct[1])));
  if (/\b(max|maximum|full|hundred)\b/.test(t))     return 100;
  if (/\b(zero|none|minimum|min)\b/.test(t))        return 0;
  if (/\b(half|fifty|medium|mid)\b/.test(t))        return 50;
  if (/\b(low|slow|quiet|weak|dim)\b/.test(t))      return 30;
  if (/\b(high|fast|strong|loud|bright)\b/.test(t)) return 90;
  const num = t.match(NUM_RE);
  return num ? Math.min(100, Math.max(0, parseInt(num[1]))) : null;
}

function getVoiceLabel(widget) {
  try {
    const raw = widget.settings_json;
    const s = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    return (s.voiceLabel || '').toLowerCase().trim();
  } catch { return ''; }
}

function scoreWidget(widget, text) {
  // 1. voiceLabel — highest priority, whole-token aware
  const voiceLabel = getVoiceLabel(widget);
  if (voiceLabel) {
    if (text.includes(voiceLabel)) return 100;
    const vlWords = voiceLabel.split(/\s+/).filter(w => w.length > 1);
    const vlHits  = vlWords.filter(w => hasToken(text, w));
    if (vlHits.length > 0) return Math.round((vlHits.length / vlWords.length) * 88);
  }

  const rawLabel = (widget.title || '').toLowerCase();
  if (!rawLabel) return 0;

  // 2. Normalise the stored label (same alias rules as spoken text) then exact-match.
  // e.g. "LED 2" → "led2" matches the normalised transcript "led2".
  const normLabel = normalizeLabel(rawLabel);
  if (text.includes(normLabel)) return 80;

  // 3. Partial match on normalised label tokens — whole-token only to prevent
  // "led" (from "LED 1") from matching inside "led2".
  const words = normLabel.split(/\s+/).filter(w => w.length > 1 || /^\d+$/.test(w));
  if (!words.length) return 0;
  const hits = words.filter(w => hasToken(text, w));
  return hits.length === 0 ? 0 : Math.round((hits.length / words.length) * 60);
}

function pinFromKey(dataKey) {
  if (!dataKey) return -1;
  const m = String(dataKey).match(/V?(\d+)/i);
  return m ? parseInt(m[1]) : -1;
}

function inferCommand(widgetType) {
  if (widgetType === 'switch' || widgetType === 'button') return 'relay';
  if (widgetType === 'slider')                            return 'pwm';
  return 'set';
}

// Find the best widget(s) for a normalised text command.
// • Splits on "," and "and" to detect explicit multi-device intent.
// • For single-target applies a strict 3-tier priority so "led2" never
//   co-selects "led1", "switch2", "push button", etc.
function findCandidates(t, widgets) {
  const segments = t.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);

  const seenIds = new Set();
  const found   = [];

  for (const seg of segments) {
    const best = widgets
      .map(w => ({ w, s: scoreWidget(w, seg) }))
      .filter(x => x.s > 0 && !seenIds.has(x.w.id))
      .sort((a, b) => b.s - a.s)[0];
    if (best) { found.push(best.w); seenIds.add(best.w.id); }
  }

  // Each segment resolved to a distinct widget → explicit multi-device command
  if (found.length > 1) return found;

  // Single target — strict priority hierarchy
  const all = widgets
    .map(w => ({ w, s: scoreWidget(w, t) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (!all.length) return [];

  // Priority 1 & 2: exact match (score ≥ 80) — return only tied top exact matches
  const exactMatches = all.filter(x => x.s >= 80);
  if (exactMatches.length) {
    const topScore = exactMatches[0].s;
    return exactMatches.filter(x => x.s === topScore).map(x => x.w);
  }

  // Priority 3: fuzzy fallback — only widgets that tie at the very top score
  // (no ±band) to prevent weak partial matches from co-triggering unrelated devices
  const topFuzzy = all[0].s;
  if (topFuzzy < 30) return []; // reject very weak matches
  return all.filter(x => x.s === topFuzzy).slice(0, 4).map(x => x.w);
}

function parseIntent(text, widgets, macros, sensorData, lang = 'en-US', customAliases = {}) {
  const t   = normalizeText(text, customAliases);
  const tts = getTTS(lang);

  // 1. Macro match
  const macro = (macros || []).find(m => m.name && t.includes(m.name.toLowerCase()));
  if (macro) {
    return {
      ok: true, type: 'macro',
      actions: macro.actions || [],
      message: `Macro: "${macro.name}"`,
      tts: tts.macro(macro.name),
    };
  }

  // 2. Detect intent
  const isOn  = ON_RE.test(t) && !OFF_RE.test(t);
  const isOff = OFF_RE.test(t);
  const isInc = !isOn && !isOff && INC_RE.test(t);
  const isDec = !isOn && !isOff && DEC_RE.test(t);
  const value = extractValue(t);

  // 3. Find target widgets
  let candidates = [];
  if (ALL_LIGHTS_RE.test(t)) {
    candidates = widgets.filter(w =>
      ['switch', 'button', 'led'].includes(w.type) ||
      /light|lamp|bulb|relay|led/.test((w.title || '').toLowerCase())
    );
  } else if (ALL_SW_RE.test(t) && (isOn || isOff)) {
    candidates = widgets.filter(w => ['switch', 'button'].includes(w.type));
  } else {
    candidates = findCandidates(t, widgets);
  }

  if (!candidates.length) {
    return {
      ok: false,
      message: `No widget matched "${text}". Say the widget title clearly.`,
      tts: tts.noMatch(),
    };
  }

  // 4. Build actions (state-aware)
  const actions        = [];
  const names          = [];
  const alreadyInState = [];

  for (const w of candidates) {
    const pin = pinFromKey(w.data_key);
    if (pin < 0 || !w.device_id) continue;

    if (isOn || isOff) {
      const raw      = ((sensorData || {})[w.device_id] || {})[w.data_key];
      const curIsOn  = (raw !== undefined && raw !== null) ? Number(raw) > 0 : null;
      if (isOn  && curIsOn === true)  { alreadyInState.push(w.title || `Widget ${w.id}`); continue; }
      if (isOff && curIsOn === false) { alreadyInState.push(w.title || `Widget ${w.id}`); continue; }
    }

    let val;
    if      (isOn)  val = 1;
    else if (isOff) val = 0;
    else if (isInc) {
      const cur = Number(((sensorData || {})[w.device_id] || {})[w.data_key] ?? 50);
      val = Math.min(100, cur + STEP);
    }
    else if (isDec) {
      const cur = Number(((sensorData || {})[w.device_id] || {})[w.data_key] ?? 50);
      val = Math.max(0, cur - STEP);
    }
    else if (value !== null) val = value;
    else continue;

    actions.push({ deviceId: w.device_id, pin, dataKey: w.data_key, command: inferCommand(w.type), value: val });
    names.push(w.title || `Widget ${w.id}`);
  }

  // All candidates already in desired state
  if (!actions.length && alreadyInState.length) {
    const devList = alreadyInState.join(', ');
    return {
      ok: false, type: 'already',
      message: `${devList} ${alreadyInState.length === 1 ? 'is' : 'are'} already ${isOn ? 'ON' : 'OFF'}.`,
      tts: isOn ? tts.alreadyOn(devList) : tts.alreadyOff(devList),
    };
  }

  if (!actions.length) {
    const found = candidates.map(c => c.title).join(', ');
    return {
      ok: false,
      message: `Found "${found}" — say "turn on", "turn off", or "set to 50%".`,
      tts: tts.specify(),
    };
  }

  // 5. Compose result
  const actionStr = isOn ? 'ON' : isOff ? 'OFF' : isInc ? '▲' : isDec ? '▼' : `${value}%`;
  let message = `${names.join(', ')} → ${actionStr}`;
  if (alreadyInState.length) message += ` · ${alreadyInState.join(', ')} already ${isOn ? 'ON' : 'OFF'}`;

  const shortNames = names.length === 1 ? names[0]
    : names.length === 2 ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

  const ttsStr = isOn  ? tts.turnOn(shortNames)
    : isOff            ? tts.turnOff(shortNames)
    : isInc            ? tts.increase(shortNames)
    : isDec            ? tts.decrease(shortNames)
    :                    tts.setTo(shortNames, value);

  return {
    ok: true,
    type: isOn ? 'on' : isOff ? 'off' : 'set',
    actions, message,
    tts: ttsStr,
    skipped: alreadyInState,
  };
}

// ── Waveform ──────────────────────────────────────────────────────────────────
function WaveformBars({ active }) {
  return (
    <div className="flex items-end justify-center gap-[3px]" style={{ height: 28 }}>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} style={{
          width: 3, height: '100%', borderRadius: 99,
          transformOrigin: 'bottom', transform: 'scaleY(0.15)',
          background: active
            ? `rgba(239,68,68,${0.4 + (i % 3) * 0.2})`
            : 'rgba(100,116,139,0.15)',
          animation: active
            ? `voiceBar ${0.28 + (i % 7) * 0.07}s ease-in-out infinite alternate`
            : 'none',
          animationDelay: `${i * 38}ms`,
        }} />
      ))}
    </div>
  );
}

// ── Voice view ────────────────────────────────────────────────────────────────
function VoiceView({ listening, transcript, status, startListening, stopListening, supported, macros, sendCommand, recLang }) {
  const quickMacros = (macros || []).filter(m => (m.actions || []).length > 0).slice(0, 6);
  const tts = getTTS(recLang);

  return (
    <div className="p-4 space-y-3">

      {quickMacros.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Macros</p>
          <div className="flex flex-wrap gap-1.5">
            {quickMacros.map(m => (
              <button key={m.id}
                onClick={() => {
                  Promise.all(m.actions.map(a => sendCommand(a))).catch(() => {});
                  speak(tts.macro(m.name), recLang);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}
              >
                <Zap size={9} />{m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mic */}
      <div className="flex flex-col items-center py-4 gap-3">
        <button
          onClick={listening ? stopListening : startListening}
          disabled={!supported}
          className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95"
          style={listening ? {
            background: 'rgba(239,68,68,0.12)',
            border: '2px solid rgba(239,68,68,0.55)',
            boxShadow: '0 0 32px rgba(239,68,68,0.4)',
          } : {
            background: 'linear-gradient(135deg,rgba(14,165,233,0.15),rgba(99,102,241,0.15))',
            border: '2px solid rgba(14,165,233,0.4)',
            boxShadow: '0 0 28px rgba(14,165,233,0.2)',
          }}
        >
          {listening && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: 'rgba(239,68,68,0.6)' }} />
          )}
          <Mic size={24} className={listening ? 'text-red-400' : 'text-sky-400'} />
        </button>
        <WaveformBars active={listening} />
        <p className="text-[11px] text-center" style={{ color: listening ? '#f87171' : '#64748b' }}>
          {!supported ? 'Use Chrome or Edge — Web Speech not supported'
            : listening ? 'Listening… tap to stop'
            : 'Tap mic and speak a command'}
        </p>
      </div>

      {transcript && (
        <div className="px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Heard</p>
          <p className="text-sm text-slate-200 italic">"{transcript}"</p>
        </div>
      )}

      {status && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
          style={
            status.ok         ? { background: 'rgba(16,185,129,0.07)',  border: '1px solid rgba(16,185,129,0.2)' }
            : status.type === 'already'
                               ? { background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }
                               : { background: 'rgba(239,68,68,0.07)',  border: '1px solid rgba(239,68,68,0.2)' }
          }>
          {status.ok
            ? <Check       size={13} className="text-emerald-400 mt-0.5 shrink-0" />
            : status.type === 'already'
            ? <AlertCircle size={13} className="text-amber-400  mt-0.5 shrink-0" />
            : <AlertCircle size={13} className="text-red-400    mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-xs leading-relaxed ${
              status.ok ? 'text-emerald-300' : status.type === 'already' ? 'text-amber-300' : 'text-red-300'
            }`}>
              {status.message}
            </p>
            {status.ok && (status.actions || []).length > 0 && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                {status.actions.length} action{status.actions.length !== 1 ? 's' : ''}
                {status.skipped?.length ? ` · ${status.skipped.length} already set` : ''}
              </p>
            )}
          </div>
          {status.ok && <Volume2 size={11} className="text-emerald-600 mt-0.5 shrink-0" />}
        </div>
      )}

      {!transcript && !status && (
        <div>
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1.5">Examples</p>
          {[
            ['"Turn on LED2"',                'EN'],
            ['"Hidupkan kipas dan lampu 1"',  'MY'],
            ['"打开风扇"',                     'ZH'],
            ['"on led1, led2 and fan"',       'Multi'],
            ['"Set fan to 70 percent"',       'EN'],
            ['"Turn off all lights"',         'EN'],
          ].map(([hint, badge]) => (
            <div key={hint} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Mic size={9} className="text-slate-700 shrink-0" />
              <span className="text-[11px] text-slate-600 italic flex-1 truncate">{hint}</span>
              <span className="text-[9px] text-slate-700 font-mono shrink-0">{badge}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Macros view ───────────────────────────────────────────────────────────────
function MacrosView({ store, updateStore, devices }) {
  const macros = store.macros || [];
  const [adding,     setAdding]     = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newActions, setNewActions] = useState([{ deviceId: '', pin: '0', value: '1' }]);

  function saveMacro() {
    if (!newName.trim()) return;
    const actions = newActions
      .filter(a => a.deviceId && !isNaN(parseInt(a.pin)))
      .map(a => ({ deviceId: a.deviceId, pin: parseInt(a.pin), value: parseFloat(a.value) || 0 }));
    updateStore({ ...store, macros: [...macros, { id: `m_${Date.now()}`, name: newName.trim().toLowerCase(), actions }] });
    setNewName(''); setNewActions([{ deviceId: '', pin: '0', value: '1' }]); setAdding(false);
  }
  function removeMacro(id) { updateStore({ ...store, macros: macros.filter(m => m.id !== id) }); }
  function updateRow(i, k, v) { setNewActions(p => p.map((a, idx) => idx === i ? { ...a, [k]: v } : a)); }
  function removeRow(i) { setNewActions(p => p.filter((_, idx) => idx !== i)); }

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Voice Macros</p>
        <p className="text-[11px] text-slate-700 leading-relaxed">Say the macro name to fire multiple actions at once.</p>
      </div>
      <div className="space-y-2">
        {macros.length === 0 && <p className="text-xs text-slate-700 italic py-1">No macros yet.</p>}
        {macros.map(m => (
          <div key={m.id} className="px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Zap size={10} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-300">"{m.name}"</span>
              </div>
              <button onClick={() => removeMacro(m.id)} className="text-slate-700 hover:text-red-400 transition-colors p-0.5">
                <Trash2 size={11} />
              </button>
            </div>
            <div className="space-y-0.5">
              {(m.actions || []).map((a, i) => {
                const dev = devices.find(d => String(d.id) === String(a.deviceId));
                return <p key={i} className="text-[10px] text-slate-600 font-mono">{dev?.name || `#${a.deviceId}`} → V{a.pin} = {a.value}</p>;
              })}
              {!(m.actions || []).length && <p className="text-[10px] text-slate-700 italic">No actions</p>}
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="p-3 rounded-xl space-y-2.5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(14,165,233,0.2)' }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder='Macro name — e.g. "sleep mode"'
            className="w-full px-2.5 py-1.5 rounded-lg text-xs text-slate-200 outline-none placeholder-slate-600"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            onKeyDown={e => { if (e.key === 'Enter') saveMacro(); if (e.key === 'Escape') setAdding(false); }}
          />
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Actions</p>
          {newActions.map((a, i) => (
            <div key={i} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: '1fr 44px 44px 18px' }}>
              <select value={a.deviceId} onChange={e => updateRow(i, 'deviceId', e.target.value)}
                className="appearance-none px-2 py-1.5 rounded-lg text-xs text-slate-200 outline-none truncate"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="">Device…</option>
                {devices.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
              <input type="number" min="0" max="255" placeholder="V#" value={a.pin}
                onChange={e => updateRow(i, 'pin', e.target.value)}
                className="px-1 py-1.5 rounded-lg text-xs text-slate-200 outline-none text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <input type="number" min="0" max="255" placeholder="Val" value={a.value}
                onChange={e => updateRow(i, 'value', e.target.value)}
                className="px-1 py-1.5 rounded-lg text-xs text-slate-200 outline-none text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              {newActions.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-slate-600 hover:text-red-400 transition-colors flex justify-center">
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setNewActions(p => [...p, { deviceId: '', pin: '0', value: '1' }])}
            className="flex items-center gap-1 text-[11px] text-sky-500 hover:text-sky-400 transition-colors">
            <Plus size={10} /> Add action
          </button>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setAdding(false)}
              className="flex-1 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={saveMacro} disabled={!newName.trim()}
              className="flex-[2] py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: 'rgba(14,165,233,0.25)', border: '1px solid rgba(14,165,233,0.35)' }}>
              Save Macro
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors py-1">
          <Plus size={12} /> Add macro
        </button>
      )}
      <p className="text-[10px] text-slate-700 leading-relaxed pt-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        Tip: macro names are case-insensitive. Say "activate sleep mode" or just "sleep mode".
      </p>
    </div>
  );
}

// ── Settings view ─────────────────────────────────────────────────────────────
function SettingsView({ widgets, devices, loading, onRefresh, store, updateStore }) {
  const recLang = store.recLang || 'en-US';

  // Custom alias draft state — saved to store on blur
  const [onDraft,  setOnDraft]  = useState((store.customOn  || []).join(', '));
  const [offDraft, setOffDraft] = useState((store.customOff || []).join(', '));

  function saveAliases() {
    const on  = onDraft.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const off = offDraft.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    updateStore({ ...store, customOn: on, customOff: off });
  }

  return (
    <div className="p-4 space-y-4">

      {/* Widget list */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Detected Widgets</p>
        <button onClick={onRefresh}
          className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-sky-400 transition-colors px-1.5 py-0.5 rounded"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <RefreshCw size={9} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {loading && <p className="text-xs text-slate-700 py-1">Loading…</p>}
      {!loading && !widgets.length && <p className="text-xs text-slate-700 italic">No widgets found. Create a dashboard first.</p>}
      <div className="space-y-1 max-h-36 overflow-y-auto -mt-2" style={{ scrollbarWidth: 'thin' }}>
        {widgets.map(w => {
          const dev = devices.find(d => String(d.id) === String(w.device_id));
          return (
            <div key={w.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                ['switch','button'].includes(w.type) ? 'bg-amber-500' :
                ['slider','gauge'].includes(w.type)  ? 'bg-sky-500'   :
                w.type === 'led'                     ? 'bg-emerald-500': 'bg-slate-600'
              }`} />
              <span className="text-xs text-slate-300 flex-1 truncate">{w.title || '(untitled)'}</span>
              <span className="text-[10px] text-slate-600 font-mono shrink-0">{w.data_key || '—'}</span>
              {dev && <span className="text-[10px] text-slate-700 truncate max-w-[60px]">{dev.name}</span>}
            </div>
          );
        })}
      </div>

      {/* Recognition language */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Recognition Language</p>
        <div className="flex gap-1.5">
          {[
            { code: 'en-US', label: 'English' },
            { code: 'ms-MY', label: 'Malay' },
            { code: 'zh-CN', label: '中文' },
          ].map(({ code, label }) => (
            <button key={code}
              onClick={() => updateStore({ ...store, recLang: code })}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
              style={recLang === code
                ? { background: 'rgba(14,165,233,0.22)', border: '1px solid rgba(14,165,233,0.5)', color: '#38bdf8' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
          Replies and TTS will switch to the selected language. Malay/Chinese input is normalised regardless.
        </p>
      </div>

      {/* Custom command words */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Custom Command Words</p>
        <p className="text-[11px] text-slate-700 mb-2 leading-relaxed">
          Add your own trigger words (comma-separated). These override built-in Malay/English words.
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-500 font-bold w-7 shrink-0">ON</span>
            <input
              value={onDraft}
              onChange={e => setOnDraft(e.target.value)}
              onBlur={saveAliases}
              placeholder="buka, nyala, pasang, hidupkan…"
              className="flex-1 px-2 py-1.5 rounded-lg text-xs text-slate-200 outline-none placeholder-slate-700"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-500 font-bold w-7 shrink-0">OFF</span>
            <input
              value={offDraft}
              onChange={e => setOffDraft(e.target.value)}
              onBlur={saveAliases}
              placeholder="tutup, kunci, padamkan…"
              className="flex-1 px-2 py-1.5 rounded-lg text-xs text-slate-200 outline-none placeholder-slate-700"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            />
          </div>
        </div>
      </div>

      {/* Command guide */}
      <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Command Guide</p>
        {[
          ['ON / OFF',   '"Turn on kitchen light"'],
          ['Malay',      '"Hidupkan kipas dan lampu 1"'],
          ['Chinese',    '"打开风扇"'],
          ['Multi',      '"on led1, led2 and fan"'],
          ['Set value',  '"Set fan to 60 percent"'],
          ['Relative',   '"Make it brighter"'],
          ['Group',      '"Turn off all lights"'],
          ['Macro',      '"Activate sleep mode"'],
        ].map(([type, ex]) => (
          <div key={type} className="flex items-baseline gap-2 px-2 py-1 rounded mb-0.5"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="text-[10px] font-bold text-slate-600 w-14 shrink-0">{type}</span>
            <span className="text-[11px] text-slate-500 italic truncate">{ex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VoiceControl() {
  const { token } = useAuth();

  const [open,       setOpen]       = useState(false);
  const [view,       setView]       = useState('voice');
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status,     setStatus]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [devices,    setDevices]    = useState([]);
  const [widgets,    setWidgets]    = useState([]);
  const [sensorData, setSensorData] = useState({});
  const [store,      setStore]      = useState(loadStore);

  const macros = store.macros || [];

  const recRef              = useRef(null);
  const socketRef           = useRef(null);
  const finalRef            = useRef('');
  const widgetsRef          = useRef([]);
  const macrosRef           = useRef([]);
  const sensorRef           = useRef({});
  const storeRef            = useRef(store);
  const subscribedDevicesRef = useRef([]);

  useEffect(() => { widgetsRef.current = widgets;    }, [widgets]);
  useEffect(() => { macrosRef.current  = macros;     }, [macros]);
  useEffect(() => { sensorRef.current  = sensorData; }, [sensorData]);
  useEffect(() => { storeRef.current   = store;      }, [store]);

  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const id = 'iot-voice-wave';
    if (!document.getElementById(id)) {
      const el = Object.assign(document.createElement('style'), { id, textContent: WAVE_CSS });
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    socketRef.current = getSocket(token);
    const socket = socketRef.current;
    function onUpdate(event) {
      setSensorData(prev => ({
        ...prev,
        [event.device_id]: { ...(prev[event.device_id] || {}), ...event.data },
      }));
    }
    socket.on('sensor_update', onUpdate);
    return () => socket.off('sensor_update', onUpdate);
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, dashRes] = await Promise.all([api.get('/device/list'), api.get('/dashboard')]);
      setDevices(devRes.data || []);
      const results = await Promise.all(
        (dashRes.data || []).map(d => api.get(`/dashboard/${d.id}/widgets`).catch(() => ({ data: [] })))
      );
      const allWidgets = results.flatMap(r => r.data || []);
      setWidgets(allWidgets);

      // Subscribe to device rooms so live sensor_update events populate sensorData,
      // enabling state-awareness checks ("already ON/OFF") from first use.
      const socket = socketRef.current;
      if (socket) {
        subscribedDevicesRef.current.forEach(id => socket.emit('unsubscribe_device', { device_id: id }));
        const deviceIds = [...new Set(allWidgets.map(w => w.device_id).filter(Boolean))];
        deviceIds.forEach(id => socket.emit('subscribe_device', { device_id: id }));
        subscribedDevicesRef.current = deviceIds;
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (open) loadData(); }, [open]);

  function updateStore(s) { setStore(s); saveStore(s); }

  async function sendCommand(action) {
    const dataKey = action.dataKey || (Number.isInteger(action.pin) && action.pin >= 0 ? `V${action.pin}` : null);
    if (!dataKey || !action.deviceId) return;
    // Optimistic update: reflect the commanded value immediately so the
    // state-awareness check ("already ON/OFF") works for any subsequent command
    // sent in the same session, even before the hardware round-trip completes.
    setSensorData(prev => ({
      ...prev,
      [action.deviceId]: { ...(prev[action.deviceId] || {}), [dataKey]: action.value },
    }));
    try {
      await api.post('/device/command', {
        device_id: action.deviceId,
        command:   action.command || 'set',
        payload:   { value: action.value },
        data_key:  dataKey,
      });
    } catch (e) {
      console.warn('[Voice] command failed:', e?.response?.data || e.message);
    }
  }

  function startListening() {
    if (!supported || listening) return;
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang           = storeRef.current.recLang || 'en-US';
    rec.continuous     = false;
    rec.interimResults = true;
    recRef.current  = rec;
    finalRef.current = '';

    rec.onstart  = () => { setListening(true); setTranscript(''); setStatus(null); };
    rec.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final   += e.results[i][0].transcript;
        else                       interim += e.results[i][0].transcript;
      }
      setTranscript(final || interim);
      if (final) finalRef.current = final;
    };
    rec.onerror = e => {
      setListening(false);
      if (e.error !== 'no-speech') setStatus({ ok: false, message: `Mic error: ${e.error}` });
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (!text) return;
      const s = storeRef.current;
      const result = parseIntent(
        text,
        widgetsRef.current,
        macrosRef.current,
        sensorRef.current,
        s.recLang || 'en-US',
        { on: s.customOn || [], off: s.customOff || [] }
      );
      if (result.ok) Promise.all(result.actions.map(a => sendCommand(a))).catch(() => {});
      speak(result.tts || (result.ok ? 'Done' : 'Command not understood'), s.recLang || 'en-US');
      setStatus(result);
    };
    rec.start();
  }

  function stopListening() { recRef.current?.stop(); }

  function doClose() {
    recRef.current?.stop();
    const socket = socketRef.current;
    if (socket) {
      subscribedDevicesRef.current.forEach(id => socket.emit('unsubscribe_device', { device_id: id }));
      subscribedDevicesRef.current = [];
    }
    setOpen(false); setView('voice'); setListening(false);
    setTranscript(''); setStatus(null); finalRef.current = '';
  }

  const recLang = store.recLang || 'en-US';

  /* ── Closed: floating button ── */
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Voice Control"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 select-none"
        style={{
          background: 'linear-gradient(135deg,#0ea5e9,#6366f1)',
          boxShadow:  '0 4px 24px rgba(14,165,233,0.5), 0 0 0 1px rgba(255,255,255,0.12)',
        }}
      >
        <Mic size={22} className="text-white" />
      </button>
    );
  }

  /* ── Open panel ── */
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={doClose} />

      {/* Panel — full-width on mobile, fixed 320 px on sm+ */}
      <div
        className="fixed z-50 flex flex-col overflow-hidden rounded-2xl
                   inset-x-2 bottom-2
                   sm:inset-x-auto sm:w-80 sm:bottom-6 sm:right-6"
        style={{
          background: 'rgba(6,12,26,0.97)',
          maxHeight: '88vh',
          border: '1px solid rgba(14,165,233,0.18)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 56px rgba(0,0,0,0.7), 0 0 60px rgba(14,165,233,0.08)',
          backdropFilter: 'blur(20px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — shrink-0 so buttons never get pushed off screen */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 min-w-0">
            {view !== 'voice' ? (
              <button onClick={() => setView('voice')}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0">
                <ArrowLeft size={14} />
              </button>
            ) : (
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)' }}>
                <Mic size={12} className="text-sky-400" />
              </div>
            )}
            <span className="text-sm font-bold text-slate-100 truncate">
              {view === 'macros' ? 'Macros' : view === 'settings' ? 'Settings' : 'Voice Control'}
            </span>
            {loading && <Loader2 size={11} className="text-slate-700 animate-spin shrink-0" />}
          </div>

          {/* Action buttons — shrink-0 ensures they're always visible */}
          <div className="flex items-center shrink-0 ml-2">
            {view === 'voice' && (
              <>
                <button onClick={() => setView('macros')} title="Voice Macros"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-white/5 transition-colors">
                  <Zap size={13} />
                </button>
                <button onClick={() => setView('settings')} title="Settings"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
                  <Settings size={13} />
                </button>
              </>
            )}
            <button onClick={doClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {view === 'voice' && (
            <VoiceView
              listening={listening} transcript={transcript} status={status}
              startListening={startListening} stopListening={stopListening}
              supported={supported} macros={macros} sendCommand={sendCommand}
              recLang={recLang}
            />
          )}
          {view === 'macros' && <MacrosView store={store} updateStore={updateStore} devices={devices} />}
          {view === 'settings' && (
            <SettingsView
              widgets={widgets} devices={devices} loading={loading} onRefresh={loadData}
              store={store} updateStore={updateStore}
            />
          )}
        </div>

        {/* Footer */}
        {view === 'voice' && (
          <div className="px-4 py-2 shrink-0 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] text-slate-700">
              {widgets.length} widget{widgets.length !== 1 ? 's' : ''} · {devices.length} device{devices.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-slate-600 font-mono">
              {recLang === 'en-US' ? 'EN' : recLang === 'ms-MY' ? 'MY' : 'ZH'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
