require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const port = Number(process.env.PORT || 3000);
const clientId = process.env.GOOGLE_CLIENT_ID;
const sessionSecret = process.env.SESSION_SECRET;
const frontendOrigins = (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const usersFile = path.join(__dirname, 'data', 'google-users.json');
const googleClient = clientId ? new OAuth2Client(clientId) : null;

if (!clientId || !sessionSecret) {
  console.warn('Google login is disabled until GOOGLE_CLIENT_ID and SESSION_SECRET are set in .env.');
}

function readUsers() {
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
  fs.mkdirSync(path.dirname(usersFile), { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), { mode: 0o600 });
}
function publicUser(user) {
  return { id: user.id, firstname: user.firstname, lastname: user.lastname, fullname: user.fullname, email: user.email, picture: user.picture, authProvider: 'google', createdAt: user.createdAt, isVerified: true };
}
function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://www.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com']
    }
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(cors({ origin(origin, callback) {
  if (!origin || frontendOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed'));
}, credentials: true }));

app.get('/api/auth/config', (req, res) => {
  if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured on the server.' });
  res.set('Cache-Control', 'no-store');
  res.json({ googleClientId: clientId });
});

app.post('/api/auth/google', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
  if (!googleClient || !sessionSecret) return res.status(503).json({ error: 'Google sign-in is not configured on the server.' });
  if (typeof req.body.credential !== 'string' || req.body.credential.length > 5000) return res.status(400).json({ error: 'A valid Google credential is required.' });

  try {
    // verifyIdToken validates the signature, issuer, audience and expiration.
    const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: clientId });
    const claims = ticket.getPayload();
    if (!claims || !claims.sub || !claims.email || !claims.email_verified) {
      return res.status(401).json({ error: 'Google did not provide a verified email address.' });
    }

    const users = readUsers();
    let user = users.find((item) => item.googleSubject === claims.sub);
    const isNewUser = !user;
    if (!user) {
      // Never auto-link a password/local account merely by matching its email.
      user = {
        id: crypto.randomUUID(), googleSubject: claims.sub, email: claims.email,
        firstname: claims.given_name || claims.name || 'Traveler', lastname: claims.family_name || '',
        fullname: claims.name || claims.email, picture: claims.picture || '', createdAt: new Date().toISOString()
      };
      users.push(user);
      writeUsers(users);
    }

    const token = makeSession(user);
    res.cookie('travelmate_session', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, path: '/' });
    res.set('Cache-Control', 'no-store');
    res.json({ user: publicUser(user), isNewUser });
  } catch (error) {
    console.error('Google credential verification failed:', error.message);
    res.status(401).json({ error: 'Google credential could not be verified. Please try again.' });
  }
});

app.use(express.static(__dirname));
app.listen(port, () => console.log(`TravelMate server running at http://127.0.0.1:${port}`));
