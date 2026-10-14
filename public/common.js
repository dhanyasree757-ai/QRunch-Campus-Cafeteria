```javascript
const QR_API = {
  tokenKey: 'qrunch_token',
  userKey: 'qrunch_user',

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = localStorage.getItem(this.tokenKey);

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || `Request failed (${response.status})`
      );
    }

    return data;
  },

  async signIn(role) {
    const token = localStorage.getItem(this.tokenKey);
    const user = JSON.parse(
      localStorage.getItem(this.userKey) || 'null'
    );

    if (token && user && user.role === role) {
      try {
        await this.request('/api/auth/me');
        return user;
      } catch (error) {
        // Invalid or expired session: clear it and go to login.
      }
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);

    window.location.replace(
      '/auth.html?role=' +
      encodeURIComponent(role) +
      '&action=login'
    );

    return new Promise(() => {});
  },

  signOut() {
    // Clear the saved login session.
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);

    // Redirect to the application's homepage.
    window.location.replace('/');
  }
};
