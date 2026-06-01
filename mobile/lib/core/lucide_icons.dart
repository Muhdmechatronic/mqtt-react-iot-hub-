import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Lucide icons rendered from SVG — compatible with all Flutter versions.
/// Color inherits from [IconTheme] when not set explicitly (works in BottomNavigationBar).
class LucideIcons {
  LucideIcons._();

  static Widget lightbulb({Color? color, double size = 24})      => _i(_kLightbulb,       color: color, size: size);
  static Widget power({Color? color, double size = 24})          => _i(_kPower,            color: color, size: size);
  static Widget helpCircle({Color? color, double size = 24})     => _i(_kHelpCircle,       color: color, size: size);
  static Widget layoutDashboard({Color? color, double size = 24})=> _i(_kLayoutDashboard,  color: color, size: size);
  static Widget cpu({Color? color, double size = 24})            => _i(_kCpu,              color: color, size: size);
  static Widget download({Color? color, double size = 24})       => _i(_kDownload,         color: color, size: size);
  static Widget logOut({Color? color, double size = 24})         => _i(_kLogOut,           color: color, size: size);
  static Widget chevronRight({Color? color, double size = 24})   => _i(_kChevronRight,     color: color, size: size);
  static Widget mic({Color? color, double size = 24})            => _i(_kMic,              color: color, size: size);
  static Widget micOff({Color? color, double size = 24})         => _i(_kMicOff,           color: color, size: size);
  static Widget x({Color? color, double size = 24})              => _i(_kX,                color: color, size: size);
  static Widget edit({Color? color, double size = 24})           => _i(_kEdit,             color: color, size: size);
  static Widget palette({Color? color, double size = 24})        => _i(_kPalette,          color: color, size: size);

  // ── Core renderer ──────────────────────────────────────────────────────────

  static Widget _i(String body, {Color? color, required double size}) =>
      Builder(builder: (ctx) {
        final c = color ?? IconTheme.of(ctx).color ?? Colors.white;
        return SvgPicture.string(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
          'fill="none" stroke="white" stroke-width="2" '
          'stroke-linecap="round" stroke-linejoin="round">$body</svg>',
          width: size,
          height: size,
          colorFilter: ColorFilter.mode(c, BlendMode.srcIn),
        );
      });

  // ── SVG paths (Lucide 0.263) ───────────────────────────────────────────────

  static const _kLightbulb =
      '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>'
      '<path d="M9 18h6"/>'
      '<path d="M10 22h4"/>';

  static const _kPower =
      '<path d="M12 2v10"/>'
      '<path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>';

  static const _kHelpCircle =
      '<circle cx="12" cy="12" r="10"/>'
      '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>'
      '<path d="M12 17h.01"/>';

  static const _kLayoutDashboard =
      '<rect width="7" height="9" x="3" y="3" rx="1"/>'
      '<rect width="7" height="5" x="14" y="3" rx="1"/>'
      '<rect width="7" height="9" x="14" y="12" rx="1"/>'
      '<rect width="7" height="5" x="3" y="16" rx="1"/>';

  static const _kCpu =
      '<rect width="16" height="16" x="4" y="4" rx="2"/>'
      '<rect width="6" height="6" x="9" y="9" rx="1"/>'
      '<path d="M15 2v2"/><path d="M15 20v2"/>'
      '<path d="M2 15h2"/><path d="M2 9h2"/>'
      '<path d="M20 15h2"/><path d="M20 9h2"/>'
      '<path d="M9 2v2"/><path d="M9 20v2"/>';

  static const _kDownload =
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
      '<polyline points="7 10 12 15 17 10"/>'
      '<line x1="12" x2="12" y1="15" y2="3"/>';

  static const _kLogOut =
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>'
      '<polyline points="16 17 21 12 16 7"/>'
      '<line x1="21" x2="9" y1="12" y2="12"/>';

  static const _kChevronRight = '<path d="m9 18 6-6-6-6"/>';

  static const _kMic =
      '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>'
      '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>'
      '<line x1="12" x2="12" y1="19" y2="22"/>';

  static const _kMicOff =
      '<line x1="2" x2="22" y1="2" y2="22"/>'
      '<path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>'
      '<path d="M5 10v2a7 7 0 0 0 12 5"/>'
      '<path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>'
      '<path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>'
      '<line x1="12" x2="12" y1="19" y2="22"/>';

  static const _kX =
      '<path d="M18 6 6 18"/>'
      '<path d="m6 6 12 12"/>';

  static const _kEdit =
      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
      '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>';

  static const _kPalette =
      '<circle cx="13.5" cy="6.5" r=".5"/>'
      '<circle cx="17.5" cy="10.5" r=".5"/>'
      '<circle cx="8.5" cy="7.5" r=".5"/>'
      '<circle cx="6.5" cy="12.5" r=".5"/>'
      '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>';
}
