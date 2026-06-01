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
}
