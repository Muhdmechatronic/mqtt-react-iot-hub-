import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../../core/lucide_icons.dart';
import '../../models/dashboard.dart';
import '../../services/api_client.dart';

// ── Language options ──────────────────────────────────────────────────────────

enum _Lang {
  en(label: 'EN', locale: 'en_US'),
  my(label: 'MY', locale: 'ms_MY'),
  zh(label: 'ZH', locale: 'zh_CN');

  const _Lang({required this.label, required this.locale});
  final String label;
  final String locale;
}

// ── Intent types ──────────────────────────────────────────────────────────────

enum _IntentAction { turnOn, turnOff, increase, decrease, setPercent }

class _Intent {
  _Intent({
    required this.action,
    this.targetTitle,
    this.targetAll = false,
    this.percent,
  });
  final _IntentAction action;
  final String? targetTitle;
  final bool targetAll;
  final double? percent;
}

// ── Status kinds ──────────────────────────────────────────────────────────────

enum _StatusKind { none, success, error, info }

// ── FAB entry point ───────────────────────────────────────────────────────────

class VoiceControlFab extends ConsumerWidget {
  const VoiceControlFab({super.key, required this.dashboardId});
  final int dashboardId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FloatingActionButton(
      backgroundColor: const Color(0xFF0EA5E9),
      foregroundColor: Colors.white,
      tooltip: 'Voice Control',
      onPressed: () {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _VoiceControlSheet(
            dashboardId: dashboardId,
            dio: ref.read(dioProvider),
          ),
        );
      },
      child: LucideIcons.mic(color: Colors.white, size: 22),
    );
  }
}

// ── Main bottom sheet ─────────────────────────────────────────────────────────

class _VoiceControlSheet extends StatefulWidget {
  const _VoiceControlSheet({
    required this.dashboardId,
    required this.dio,
  });
  final int dashboardId;
  final Dio dio;

  @override
  State<_VoiceControlSheet> createState() => _VoiceControlSheetState();
}

class _VoiceControlSheetState extends State<_VoiceControlSheet>
    with TickerProviderStateMixin {
  final _stt = SpeechToText();
  final _tts = FlutterTts();

  bool _sttAvailable = false;
  bool _listening    = false;
  String _transcript = '';
  String _statusText = '';
  _StatusKind _statusKind = _StatusKind.none;
  _Lang _lang = _Lang.en;

  // Waveform animation
  late final List<AnimationController> _barControllers;
  late final List<Animation<double>> _barAnims;

  // Widget list cache (fetched once from backend)
  List<DashboardWidget> _widgets = [];
  bool _widgetsLoaded = false;

  @override
  void initState() {
    super.initState();

    // Set up waveform bars
    _barControllers = List.generate(
      5,
      (i) => AnimationController(
        vsync: this,
        duration: Duration(milliseconds: 400 + i * 80),
      )..repeat(reverse: true),
    );
    _barAnims = _barControllers
        .map((c) => Tween<double>(begin: 0.15, end: 1.0)
            .animate(CurvedAnimation(parent: c, curve: Curves.easeInOut)))
        .toList();

    _initStt();
    _initTts();
    _fetchWidgets();
  }

  @override
  void dispose() {
    for (final c in _barControllers) {
      c.dispose();
    }
    _stt.stop();
    _tts.stop();
    super.dispose();
  }

  Future<void> _initStt() async {
    final available = await _stt.initialize(
      onError: (e) => setState(() {
        _statusText = 'Speech error: ${e.errorMsg}';
        _statusKind = _StatusKind.error;
        _listening  = false;
      }),
      onStatus: (status) {
        if (status == 'done' || status == 'notListening') {
          if (mounted) setState(() => _listening = false);
        }
      },
    );
    if (mounted) setState(() => _sttAvailable = available);
  }

  Future<void> _initTts() async {
    await _tts.setLanguage('en-US');
    await _tts.setSpeechRate(0.5);
    await _tts.setVolume(1.0);
  }

  Future<void> _fetchWidgets() async {
    try {
      final resp = await widget.dio.get('/dashboard/${widget.dashboardId}/widgets');
      final list = (resp.data as List)
          .map((j) => DashboardWidget.fromJson(j as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() { _widgets = list; _widgetsLoaded = true; });
    } catch (_) {
      if (mounted) setState(() => _widgetsLoaded = true);
    }
  }

  void _toggleListening() {
    if (_listening) {
      _stopListening();
    } else {
      _startListening();
    }
  }

  Future<void> _startListening() async {
    if (!_sttAvailable) {
      setState(() {
        _statusText = 'Speech recognition not available on this device.';
        _statusKind = _StatusKind.error;
      });
      return;
    }
    setState(() {
      _transcript = '';
      _statusText = '';
      _statusKind = _StatusKind.none;
      _listening  = true;
    });
    await _stt.listen(
      localeId: _lang.locale,
      onResult: (result) {
        if (mounted) {
          setState(() => _transcript = result.recognizedWords);
          if (result.finalResult && result.recognizedWords.isNotEmpty) {
            _processTranscript(result.recognizedWords);
          }
        }
      },
      listenFor: const Duration(seconds: 10),
      pauseFor: const Duration(seconds: 3),
    );
  }

  Future<void> _stopListening() async {
    await _stt.stop();
    if (mounted) setState(() => _listening = false);
  }

  // ── Intent parsing ─────────────────────────────────────────────────────────

  _Intent? _parseIntent(String text) {
    final t = text.toLowerCase().trim();

    // Detect target-all phrases
    final allLights = RegExp(r'\ball (lights?|leds?|bulbs?)\b').hasMatch(t);
    final allSwitches = RegExp(r'\ball (switches?|devices?)\b').hasMatch(t);
    final targetAll = allLights || allSwitches;

    // Percentage: "set [widget] to 70%", "set [widget] to 70 percent"
    final pctMatch = RegExp(
            r'set\s+(?:(.+?)\s+)?to\s+(\d+)\s*(?:percent|%)')
        .firstMatch(t);
    if (pctMatch != null) {
      final title  = pctMatch.group(1)?.trim();
      final pct    = double.tryParse(pctMatch.group(2) ?? '') ?? 0;
      return _Intent(
          action: _IntentAction.setPercent,
          targetTitle: title,
          targetAll: targetAll,
          percent: pct);
    }

    // On/Off detection
    final onPatterns  = [
      RegExp(r'\b(turn on|switch on|enable|hidupkan|打开|开灯|开启)\b'),
    ];
    final offPatterns = [
      RegExp(r'\b(turn off|switch off|disable|matikan|关灯|关闭|关掉)\b'),
    ];

    for (final p in onPatterns) {
      if (p.hasMatch(t)) {
        final title = _extractWidgetName(t, p);
        return _Intent(
            action: _IntentAction.turnOn,
            targetTitle: title,
            targetAll: targetAll);
      }
    }
    for (final p in offPatterns) {
      if (p.hasMatch(t)) {
        final title = _extractWidgetName(t, p);
        return _Intent(
            action: _IntentAction.turnOff,
            targetTitle: title,
            targetAll: targetAll);
      }
    }

    // Increase / decrease
    final increasePatterns = [
      RegExp(r'\b(increase|brighter|higher|naikkan|tingkatkan|调高|增加)\b'),
    ];
    final decreasePatterns = [
      RegExp(r'\b(decrease|dimmer|lower|turunkan|kurangkan|调低|减少)\b'),
    ];

    for (final p in increasePatterns) {
      if (p.hasMatch(t)) {
        final title = _extractWidgetName(t, p);
        return _Intent(
            action: _IntentAction.increase,
            targetTitle: title,
            targetAll: targetAll);
      }
    }
    for (final p in decreasePatterns) {
      if (p.hasMatch(t)) {
        final title = _extractWidgetName(t, p);
        return _Intent(
            action: _IntentAction.decrease,
            targetTitle: title,
            targetAll: targetAll);
      }
    }

    return null;
  }

  String? _extractWidgetName(String text, RegExp trigger) {
    // Remove the keyword, articles, common filler, then take what's left as title guess
    var name = text
        .replaceAll(trigger, '')
        .replaceAll(RegExp(r'\b(the|a|an|all|lights?|leds?|switches?|devices?)\b'), '')
        .trim();
    return name.isEmpty ? null : name;
  }

  // ── Widget matching ────────────────────────────────────────────────────────

  List<DashboardWidget> _matchWidgets(_Intent intent) {
    if (!_widgetsLoaded || _widgets.isEmpty) return [];

    // "all lights" targets all LED + switch widgets
    if (intent.targetAll) {
      return _widgets.where((w) =>
          w.kind == WidgetKind.led ||
          w.kind == WidgetKind.switchWidget ||
          w.kind == WidgetKind.button).toList();
    }

    final query = intent.targetTitle?.toLowerCase().trim();
    if (query == null || query.isEmpty) {
      // No specific target → try to find a single controllable widget
      final controllable = _widgets.where((w) =>
          w.kind == WidgetKind.led ||
          w.kind == WidgetKind.switchWidget ||
          w.kind == WidgetKind.button ||
          w.kind == WidgetKind.slider).toList();
      if (controllable.length == 1) return controllable;
      return [];
    }

    // Fuzzy: find widgets whose title contains the query or query contains title
    final matches = _widgets.where((w) {
      final title = w.title.toLowerCase();
      return title.contains(query) || query.contains(title);
    }).toList();

    return matches;
  }

  // ── Command sending ────────────────────────────────────────────────────────

  Future<void> _sendCommand({
    required int deviceId,
    required String dataKey,
    required double value,
    String command = 'set',
  }) async {
    await widget.dio.post('/device/command', data: {
      'device_id': deviceId,
      'command': command,
      'payload': {'value': value},
      'data_key': dataKey,
    });
  }

  // ── Process transcript ─────────────────────────────────────────────────────

  Future<void> _processTranscript(String text) async {
    final intent = _parseIntent(text);

    if (intent == null) {
      setState(() {
        _statusText = 'Could not understand: "$text"';
        _statusKind = _StatusKind.error;
      });
      await _tts.speak('I did not understand the command');
      return;
    }

    final targets = _matchWidgets(intent);

    if (targets.isEmpty) {
      setState(() {
        _statusText = 'No matching widget found for: "${intent.targetTitle ?? 'any'}"';
        _statusKind = _StatusKind.error;
      });
      await _tts.speak('No matching widget found');
      return;
    }

    final results = <String>[];

    for (final w in targets) {
      if (w.deviceId == null || w.dataKey == null) continue;

      try {
        switch (intent.action) {
          case _IntentAction.turnOn:
            await _sendCommand(
                deviceId: w.deviceId!,
                dataKey: w.dataKey!,
                value: w.onValue);
            results.add('Turning on ${w.title}');

          case _IntentAction.turnOff:
            await _sendCommand(
                deviceId: w.deviceId!,
                dataKey: w.dataKey!,
                value: w.offValue);
            results.add('Turning off ${w.title}');

          case _IntentAction.increase:
            final cur = (w.kind == WidgetKind.slider)
                ? (w.sliderMin + w.sliderMax) / 2
                : w.onValue;
            final next = (cur + (w.sliderMax - w.sliderMin) * 0.1)
                .clamp(w.sliderMin, w.sliderMax);
            await _sendCommand(
                deviceId: w.deviceId!,
                dataKey: w.dataKey!,
                value: next);
            results.add('Increasing ${w.title}');

          case _IntentAction.decrease:
            final cur = (w.kind == WidgetKind.slider)
                ? (w.sliderMin + w.sliderMax) / 2
                : w.onValue;
            final next = (cur - (w.sliderMax - w.sliderMin) * 0.1)
                .clamp(w.sliderMin, w.sliderMax);
            await _sendCommand(
                deviceId: w.deviceId!,
                dataKey: w.dataKey!,
                value: next);
            results.add('Decreasing ${w.title}');

          case _IntentAction.setPercent:
            final pct  = (intent.percent ?? 0) / 100.0;
            final val  = w.sliderMin + (w.sliderMax - w.sliderMin) * pct;
            await _sendCommand(
                deviceId: w.deviceId!,
                dataKey: w.dataKey!,
                value: val);
            results.add('Setting ${w.title} to ${intent.percent?.toStringAsFixed(0)}%');
        }
      } catch (e) {
        results.add('Error controlling ${w.title}');
      }
    }

    final summary = results.join(', ');
    if (mounted) {
      setState(() {
        _statusText = summary.isEmpty ? 'Done' : summary;
        _statusKind = _StatusKind.success;
      });
    }
    if (summary.isNotEmpty) {
      await _tts.speak(results.first);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return Container(
      margin: EdgeInsets.only(top: mq.size.height * 0.25),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top:   BorderSide(color: Color(0xFF1E293B), width: 1),
          left:  BorderSide(color: Color(0xFF1E293B), width: 1),
          right: BorderSide(color: Color(0xFF1E293B), width: 1),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 16, 24, 24 + mq.viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Colors.white12,
              borderRadius: BorderRadius.circular(99),
            ),
          ),

          // Header
          Row(
            children: [
              LucideIcons.mic(color: const Color(0xFF0EA5E9), size: 20),
              const SizedBox(width: 10),
              const Text(
                'Voice Control',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              // Language selector
              ..._Lang.values.map((l) => _LangChip(
                    label: l.label,
                    selected: _lang == l,
                    onTap: () => setState(() => _lang = l),
                  )),
              const SizedBox(width: 4),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: LucideIcons.x(color: Colors.white38, size: 20),
              ),
            ],
          ),

          const SizedBox(height: 28),

          // Waveform bars (shown when listening)
          AnimatedOpacity(
            duration: const Duration(milliseconds: 200),
            opacity: _listening ? 1.0 : 0.0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(5, (i) {
                return AnimatedBuilder(
                  animation: _barAnims[i],
                  builder: (_, __) => Container(
                    width: 6,
                    height: 8 + _barAnims[i].value * 40,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0EA5E9)
                          .withValues(alpha: 0.5 + _barAnims[i].value * 0.5),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                );
              }),
            ),
          ),

          if (!_listening) const SizedBox(height: 48),

          // Mic button
          GestureDetector(
            onTap: _toggleListening,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _listening
                    ? const Color(0xFFEF4444).withValues(alpha: 0.15)
                    : const Color(0xFF0EA5E9).withValues(alpha: 0.12),
                border: Border.all(
                  color: _listening
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF0EA5E9),
                  width: 2,
                ),
                boxShadow: _listening
                    ? [
                        BoxShadow(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                          blurRadius: 24,
                          spreadRadius: 4,
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: const Color(0xFF0EA5E9).withValues(alpha: 0.20),
                          blurRadius: 16,
                          spreadRadius: 2,
                        ),
                      ],
              ),
              child: Center(
                child: _listening
                    ? LucideIcons.micOff(color: const Color(0xFFEF4444), size: 30)
                    : LucideIcons.mic(color: const Color(0xFF0EA5E9), size: 30),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Listening / idle label
          Text(
            _listening ? 'Listening… tap to stop' : 'Tap to speak',
            style: TextStyle(
              color: _listening ? const Color(0xFFEF4444) : Colors.white38,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),

          const SizedBox(height: 20),

          // Transcript
          if (_transcript.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Text(
                '"$_transcript"',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontStyle: FontStyle.italic,
                ),
                textAlign: TextAlign.center,
              ),
            ),

          if (_transcript.isNotEmpty) const SizedBox(height: 12),

          // Status message
          if (_statusKind != _StatusKind.none)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _statusColor(_statusKind).withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: _statusColor(_statusKind).withValues(alpha: 0.35)),
              ),
              child: Text(
                _statusText,
                style: TextStyle(
                  color: _statusColor(_statusKind),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
              ),
            ),

          // Example hints (when idle and no transcript)
          if (_transcript.isEmpty && _statusKind == _StatusKind.none) ...[
            const SizedBox(height: 8),
            _HintList(lang: _lang),
          ],

          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Color _statusColor(_StatusKind kind) => switch (kind) {
        _StatusKind.success => const Color(0xFF22C55E),
        _StatusKind.error   => const Color(0xFFEF4444),
        _StatusKind.info    => const Color(0xFFF59E0B),
        _StatusKind.none    => Colors.white38,
      };
}

// ── Language chip ─────────────────────────────────────────────────────────────

class _LangChip extends StatelessWidget {
  const _LangChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.only(left: 6),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: selected
                ? const Color(0xFF0EA5E9).withValues(alpha: 0.15)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(
              color: selected
                  ? const Color(0xFF0EA5E9)
                  : Colors.white.withValues(alpha: 0.15),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? const Color(0xFF0EA5E9) : Colors.white38,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      );
}

// ── Hint list ─────────────────────────────────────────────────────────────────

class _HintList extends StatelessWidget {
  const _HintList({required this.lang});
  final _Lang lang;

  static const _hints = {
    _Lang.en: [
      '"Turn on the LED"',
      '"Turn off all lights"',
      '"Set fan to 70%"',
      '"Increase brightness"',
    ],
    _Lang.my: [
      '"Hidupkan LED"',
      '"Matikan semua lampu"',
      '"Set fan kepada 70 peratus"',
      '"Naikkan kecerahan"',
    ],
    _Lang.zh: [
      '"打开灯"',
      '"关闭所有灯"',
      '"把风扇设为70%"',
      '"调高亮度"',
    ],
  };

  @override
  Widget build(BuildContext context) {
    final items = _hints[lang] ?? _hints[_Lang.en]!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Try saying:',
          style: TextStyle(color: Colors.white38, fontSize: 11),
        ),
        const SizedBox(height: 6),
        ...items.map((h) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  const SizedBox(width: 4),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0EA5E9),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(h,
                      style: const TextStyle(
                          color: Colors.white54, fontSize: 12)),
                ],
              ),
            )),
      ],
    );
  }
}
