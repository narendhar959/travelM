/* Google Identity Services bridge. The ID token is always verified by server.js. */
(function () {
  const apiBase = window.TRAVELMATE_API_URL || (location.port === '3000' ? location.origin : 'http://127.0.0.1:3000');
  let busy = false;
  let initialized = false;
  const serviceHelp = 'Google sign-in service is not running. In the TravelMate folder run: npm.cmd start, then refresh this page.';

  async function request(url, options) {
    try {
      return await fetch(url, options);
    } catch (error) {
      // A browser reports a stopped local server as the unhelpful "Failed to fetch".
      if (error instanceof TypeError) throw new Error(serviceHelp);
      throw error;
    }
  }

  function waitForGoogleIdentityServices(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
        if (Date.now() - startedAt >= timeoutMs) {
          return reject(new Error('Google Identity Services did not load. Check your internet connection and allow accounts.google.com in any ad/privacy blocker.'));
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  function feedback(message, type) {
    const element = document.getElementById(type === 'error' ? 'errorMessage' : 'successMessage');
    if (element) { element.textContent = message; element.style.display = 'block'; }
    if (type === 'error' && window.showErrorPopup) window.showErrorPopup('Google sign-in', message);
  }
  function setBusy(next) {
    busy = next;
    const host = document.getElementById('googleSignIn');
    if (host) host.style.pointerEvents = next ? 'none' : '';
    const status = document.getElementById('googleStatus');
    if (status) status.textContent = next ? 'Signing in with Google…' : '';
  }
  async function onCredential(response) {
    if (busy || !response.credential) return;
    setBusy(true);
    feedback('Signing in with Google…', 'success');
    try {
      const result = await request(`${apiBase}/api/auth/google`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data.error || 'Unable to authenticate. Please try again.');
      // Existing TravelMate pages use this public profile for their client-side display data.
      localStorage.setItem('travelmate_current_user', JSON.stringify(data.user));
      localStorage.setItem('travelmate_google_session', 'true');
      feedback(data.isNewUser ? 'Account created successfully! Redirecting…' : 'Login successful! Redirecting…', 'success');
      if (window.showProfilePopup) window.showProfilePopup(data.isNewUser ? 'register' : 'login', data.user);
      setTimeout(() => { location.href = 'main.html'; }, 1100);
    } catch (error) {
      feedback(error.message || 'Unable to authenticate. Please try again.', 'error');
      setBusy(false);
    }
  }
  async function initialise() {
    const host = document.getElementById('googleSignIn');
    if (!host) return;
    try {
      const response = await request(`${apiBase}/api/auth/config`, { credentials: 'include' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.googleClientId) throw new Error(config.error || 'Google sign-in is not configured.');
      await waitForGoogleIdentityServices();
      google.accounts.id.initialize({ client_id: config.googleClientId, callback: onCredential, auto_select: false, cancel_on_tap_outside: true });
      google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', type: 'standard', text: 'continue_with', shape: 'rectangular', width: Math.min(host.parentElement.clientWidth || 320, 360) });
      initialized = true;
    } catch (error) { feedback(error.message, 'error'); }
  }
  window.addEventListener('load', () => setTimeout(initialise, 0));
  window.addEventListener('resize', () => { if (initialized) { const host = document.getElementById('googleSignIn'); if (host) { host.innerHTML = ''; google.accounts.id.renderButton(host, { theme: 'outline', size: 'large', type: 'standard', text: 'continue_with', shape: 'rectangular', width: Math.min(host.parentElement.clientWidth || 320, 360) }); } } });
})();
