class AuthUser {
  const AuthUser({
    required this.token,
    required this.name,
    required this.email,
    this.avatar,
  });

  final String token;
  final String name;
  final String email;
  final String? avatar;

  factory AuthUser.fromJson(Map<String, dynamic> json, String token) {
    final u = json['user'] as Map<String, dynamic>? ?? json;
    return AuthUser(
      token:  token,
      name:   u['name']?.toString() ?? '',
      email:  u['email']?.toString() ?? '',
      avatar: u['avatar']?.toString() ?? u['avatar_url']?.toString(),
    );
  }
}
