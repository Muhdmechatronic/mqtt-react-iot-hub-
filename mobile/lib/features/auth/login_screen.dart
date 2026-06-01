import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_notifier.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey  = GlobalKey<FormState>();
  final _emailCtl = TextEditingController();
  final _passCtl  = TextEditingController();
  bool _obscure   = true;

  @override
  void dispose() {
    _emailCtl.dispose();
    _passCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await ref.read(authNotifierProvider.notifier)
        .loginWithEmail(_emailCtl.text.trim(), _passCtl.text);
    _showError();
  }

  Future<void> _google() async {
    await ref.read(authNotifierProvider.notifier).loginWithGoogle();
    _showError();
  }

  void _showError() {
    final err = ref.read(authNotifierProvider).error;
    if (err != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(err.toString().replaceFirst('Exception: ', '')),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth     = ref.watch(authNotifierProvider);
    final loading  = auth.isLoading;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Logo ────────────────────────────────────────────────
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: const Color(0xFF0EA5E9).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFF0EA5E9).withValues(alpha: 0.3),
                        ),
                      ),
                      child: const Icon(Icons.memory_rounded,
                          color: Color(0xFF0EA5E9), size: 28),
                    ),
                    const SizedBox(height: 24),
                    const Text('IoT Platform',
                        style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Colors.white)),
                    const SizedBox(height: 6),
                    Text('Sign in to manage your devices',
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.5),
                            fontSize: 14)),
                    const SizedBox(height: 40),

                    // ── Email ───────────────────────────────────────────────
                    _InputField(
                      controller:  _emailCtl,
                      label:       'Email',
                      hint:        'admin@example.com',
                      icon:        Icons.email_outlined,
                      keyboardType: TextInputType.emailAddress,
                      validator:   (v) => (v?.isEmpty ?? true) ? 'Email required' : null,
                    ),
                    const SizedBox(height: 16),

                    // ── Password ────────────────────────────────────────────
                    _InputField(
                      controller: _passCtl,
                      label:      'Password',
                      hint:       '••••••••',
                      icon:       Icons.lock_outline,
                      obscure:    _obscure,
                      validator:  (v) => (v?.isEmpty ?? true) ? 'Password required' : null,
                      suffix: IconButton(
                        icon: Icon(
                          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          color: Colors.white38,
                          size: 20,
                        ),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // ── Sign in button ──────────────────────────────────────
                    FilledButton(
                      onPressed: loading ? null : _submit,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF0EA5E9),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: loading
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Text('Sign In',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 16),

                    // ── Divider ────────────────────────────────────────────
                    Row(children: [
                      const Expanded(child: Divider(color: Colors.white12)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('or',
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.3),
                                fontSize: 12)),
                      ),
                      const Expanded(child: Divider(color: Colors.white12)),
                    ]),
                    const SizedBox(height: 16),

                    // ── Google Sign-In ─────────────────────────────────────
                    OutlinedButton.icon(
                      onPressed: loading ? null : _google,
                      icon: _GoogleLogo(),
                      label: const Text('Continue with Google',
                          style: TextStyle(color: Colors.white70)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.white12),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Reusable input field ──────────────────────────────────────────────────────

class _InputField extends StatelessWidget {
  const _InputField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.obscure      = false,
    this.keyboardType = TextInputType.text,
    this.validator,
    this.suffix,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final bool obscure;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller:   controller,
        obscureText:  obscure,
        keyboardType: keyboardType,
        validator:    validator,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText:    label,
          hintText:     hint,
          prefixIcon:   Icon(icon, color: Colors.white38, size: 20),
          suffixIcon:   suffix,
          labelStyle:   const TextStyle(color: Colors.white54),
          hintStyle:    const TextStyle(color: Colors.white24),
          filled:       true,
          fillColor:    Colors.white.withValues(alpha: 0.04),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: Colors.white12),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: Colors.white12),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF0EA5E9)),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: Color(0xFFEF4444)),
          ),
        ),
      );
}

// ── Google "G" logo ───────────────────────────────────────────────────────────

class _GoogleLogo extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 18, height: 18,
        child: CustomPaint(painter: _GoogleLogoPainter()),
      );
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    void arc(double startAngle, double sweepAngle, Color color) {
      final p = Paint()..color = color..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.22..strokeCap = StrokeCap.round;
      canvas.drawArc(
          Rect.fromLTWH(s * 0.05, s * 0.05, s * 0.9, s * 0.9),
          startAngle, sweepAngle, false, p);
    }
    // Simplified single-color "G" ring
    arc(-1.57, 6.28, const Color(0xFF4285F4));
  }
  @override bool shouldRepaint(_) => false;
}
