# TravelMate Google sign-in

Google sign-in now uses Google Identity Services in `login.html` and `signup.html`. The browser sends the Google ID credential to `server.js`; the server verifies its signature, issuer, audience and expiration with `google-auth-library` before it creates or retrieves a user by the immutable Google subject (`sub`). It never trusts a browser-supplied email or profile.

## Local setup

1. In this folder, run `npm install`.
2. Copy `.env.example` to `.env` and set the real `GOOGLE_CLIENT_ID` and a long random `SESSION_SECRET`. Do not commit `.env`.
3. In Google Cloud Console, add both `http://127.0.0.1:5500` and `http://localhost:5500` under **Authorized JavaScript origins** if using Live Server. Also add `http://127.0.0.1:3000` if using the included server to serve the app.
4. Start the verification service with `npm start`. Then either use Live Server at port 5500 or open `http://127.0.0.1:3000/login.html`.

No OAuth redirect URI is needed for the Google Identity Services ID-token popup flow. A redirect URI would only be needed if this app is changed to an OAuth authorization-code redirect flow.

`data/google-users.json` is created locally by the server and is intentionally ignored by Git. It is the first server-side account store in this otherwise static prototype. Existing password accounts are still browser-local `localStorage` data, so they cannot safely be auto-linked to a Google identity by email; Google accounts are only matched by their verified Google subject.
