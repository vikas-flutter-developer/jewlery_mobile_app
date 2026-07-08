import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'branding@gmail.com');
  final _passwordController = TextEditingController(text: 'branding');
  final _phoneController = TextEditingController(text: '7558556969');
  final _otpController = TextEditingController();

  bool _isStaffMode = true; // Toggle between Staff Login & Customer OTP
  bool _otpSent = false;     // OTP requested status

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final authNotifier = ref.read(authProvider.notifier);

    if (_isStaffMode) {
      // Staff login flow
      final success = await authNotifier.login(
        _emailController.text.trim(),
        _passwordController.text.trim(),
      );
      if (mounted && !success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid credentials or server error.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } else {
      // Customer OTP flow
      if (!_otpSent) {
        // Step 1: Request OTP
        final success = await authNotifier.requestCustomerOtp(_phoneController.text.trim());
        if (success) {
          setState(() {
            _otpSent = true;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('OTP sent to your phone.'),
              backgroundColor: AppTheme.goldDark,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to send OTP.'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      } else {
        // Step 2: Verify OTP
        final success = await authNotifier.verifyCustomerOtp(
          _phoneController.text.trim(),
          _otpController.text.trim(),
        );
        if (mounted && !success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Verification failed. Try again.'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9F6F0), // Luxury Warm Alabaster
      body: Stack(
        children: [
          // Background soft abstract gold glow
          Positioned(
            top: -150,
            right: -100,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.goldLight.withValues(alpha: 0.25),
                // Soft blur
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.goldLight.withValues(alpha: 0.3),
                    blurRadius: 120,
                    spreadRadius: 40,
                  )
                ],
              ),
            ),
          ),
          Positioned(
            bottom: -100,
            left: -150,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.goldMetallic.withValues(alpha: 0.1),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.goldMetallic.withValues(alpha: 0.1),
                    blurRadius: 100,
                    spreadRadius: 20,
                  )
                ],
              ),
            ),
          ),
          
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Icon & Header
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppTheme.goldMetallic.withValues(alpha: 0.4), width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.goldDark.withValues(alpha: 0.05),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.diamond_outlined,
                          size: 40,
                          color: AppTheme.goldDark,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'AURAJEWEL',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.goldDark,
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 8.0,
                        fontFamily: 'serif',
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'FINE RETAIL & MANUFACTURING',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.black38,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2.0,
                      ),
                    ),
                    const SizedBox(height: 36),

                    // Elegant Glassmorphic Login Card
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: AppTheme.goldMetallic.withValues(alpha: 0.25), width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 24,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Segmented control toggle
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF3EFE9),
                                borderRadius: BorderRadius.circular(30),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => setState(() {
                                        _isStaffMode = true;
                                        _otpSent = false;
                                      }),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        decoration: BoxDecoration(
                                          color: _isStaffMode ? AppTheme.goldDark : Colors.transparent,
                                          borderRadius: BorderRadius.circular(26),
                                          boxShadow: _isStaffMode ? [
                                            BoxShadow(
                                              color: AppTheme.goldDark.withValues(alpha: 0.2),
                                              blurRadius: 8,
                                              offset: const Offset(0, 3),
                                            )
                                          ] : null,
                                        ),
                                        child: Text(
                                          'STAFF PORTAL',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            color: _isStaffMode ? Colors.white : Colors.black45,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 11,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => setState(() {
                                        _isStaffMode = false;
                                        _otpSent = false;
                                      }),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                        decoration: BoxDecoration(
                                          color: !_isStaffMode ? AppTheme.goldDark : Colors.transparent,
                                          borderRadius: BorderRadius.circular(26),
                                          boxShadow: !_isStaffMode ? [
                                            BoxShadow(
                                              color: AppTheme.goldDark.withValues(alpha: 0.2),
                                              blurRadius: 8,
                                              offset: const Offset(0, 3),
                                            )
                                          ] : null,
                                        ),
                                        child: Text(
                                          'CUSTOMER',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            color: !_isStaffMode ? Colors.white : Colors.black45,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 11,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),

                            // Error prompt
                            if (authState.error != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.redAccent.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.redAccent.withValues(alpha: 0.2)),
                                ),
                                child: Text(
                                  authState.error!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.w500),
                                ),
                              ),
                              const SizedBox(height: 24),
                            ],

                            // Input fields
                            if (_isStaffMode) ...[
                              // Email
                              TextFormField(
                                controller: _emailController,
                                keyboardType: TextInputType.emailAddress,
                                decoration: const InputDecoration(
                                  labelText: 'Email Address',
                                  prefixIcon: Icon(Icons.email_outlined, size: 20),
                                ),
                                validator: (value) {
                                  if (value == null || value.isEmpty) return 'Enter email';
                                  if (!value.contains('@')) return 'Enter a valid email';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 18),
                              // Password
                              TextFormField(
                                controller: _passwordController,
                                obscureText: true,
                                decoration: const InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon: Icon(Icons.lock_outlined, size: 20),
                                ),
                                validator: (value) {
                                  if (value == null || value.isEmpty) return 'Enter password';
                                  return null;
                                },
                              ),
                            ] else ...[
                              // Phone
                              TextFormField(
                                controller: _phoneController,
                                keyboardType: TextInputType.phone,
                                enabled: !_otpSent,
                                decoration: const InputDecoration(
                                  labelText: 'Mobile Phone Number',
                                  prefixIcon: Icon(Icons.phone_android_outlined, size: 20),
                                  hintText: '7558556969',
                                ),
                                validator: (value) {
                                  if (value == null || value.isEmpty) return 'Enter phone';
                                  return null;
                                },
                              ),
                              if (_otpSent) ...[
                                const SizedBox(height: 18),
                                TextFormField(
                                  controller: _otpController,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Verification OTP',
                                    prefixIcon: Icon(Icons.domain_verification_outlined, size: 20),
                                    hintText: 'Enter OTP',
                                  ),
                                  validator: (value) {
                                    if (value == null || value.isEmpty) return 'Enter OTP';
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 8),
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: TextButton(
                                    onPressed: () {
                                      setState(() {
                                        _otpSent = false;
                                        _otpController.clear();
                                      });
                                    },
                                    child: const Text(
                                      'Change phone number?',
                                      style: TextStyle(color: AppTheme.goldDark, fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                              ],
                            ],

                            const SizedBox(height: 36),

                            // Submit Button
                            ElevatedButton(
                              onPressed: authState.isLoading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                backgroundColor: AppTheme.goldDark,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                elevation: 2,
                                shadowColor: AppTheme.goldDark.withValues(alpha: 0.3),
                              ),
                              child: authState.isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                      ),
                                    )
                                  : Text(
                                      _isStaffMode
                                          ? 'SIGN IN'
                                          : (_otpSent ? 'VERIFY OTP' : 'SEND OTP'),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                        letterSpacing: 1.5,
                                      ),
                                    ),
                            ),
                            const SizedBox(height: 24),
                            
                            // Demo quick login options
                            const Row(
                              children: [
                                Expanded(child: Divider(color: Colors.black12)),
                                Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 8.0),
                                  child: Text(
                                    'DEMO QUICK LOGIN',
                                    style: TextStyle(
                                      fontSize: 9,
                                      color: Colors.black38,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.0,
                                    ),
                                  ),
                                ),
                                Expanded(child: Divider(color: Colors.black12)),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      setState(() {
                                        _isStaffMode = true;
                                        _emailController.text = 'branding@gmail.com';
                                        _passwordController.text = 'branding';
                                      });
                                      _submit();
                                    },
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: AppTheme.goldDark,
                                      side: const BorderSide(color: AppTheme.goldMetallic, width: 1.2),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                    ),
                                    child: const Text('ADMIN', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 0.5)),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      setState(() {
                                        _isStaffMode = true;
                                        _emailController.text = 'bhavesh_karigar@gmail.com';
                                        _passwordController.text = 'karigar';
                                      });
                                      _submit();
                                    },
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: AppTheme.goldDark,
                                      side: const BorderSide(color: AppTheme.goldMetallic, width: 1.2),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                    ),
                                    child: const Text('KARIKAR', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 0.5)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
