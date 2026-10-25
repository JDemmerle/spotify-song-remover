/**
 * Backend for the Spotify song remover.
 *
 * Only handles the Authorization Code oAuth2 flow against the Spotify
 * Accounts service, so the client secret never leaves the server.
 * The browser talks to the Spotify Web API directly (see public/main.js).
 *
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */

var express = require('express');
var crypto = require('crypto');
var cookieParser = require('cookie-parser');

var client_id = process.env.SPOTIFY_CLIENT_ID;
var client_secret = process.env.SPOTIFY_CLIENT_SECRET;
// Spotify no longer accepts "localhost" as redirect URI, only HTTPS or loopback IPs
var redirect_uri = process.env.SPOTIFY_REDIRECT_URL || 'http://127.0.0.1:8888/callback';
var listen_host = process.env.LISTEN_HOST || '127.0.0.1';
var port = 8888;

if (!client_id || !client_secret) {
  console.error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set');
  process.exit(1);
}

var isHttps = redirect_uri.startsWith('https://');
var stateKey = 'spotify_auth_state';
var scope = 'user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';
var basicAuth = 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64');

var CSP = [
  "default-src 'self'",
  "connect-src 'self' https://api.spotify.com",
  "img-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
];
if (isHttps) CSP.push('upgrade-insecure-requests');

var HEADERS = {
  "Content-Security-Policy": CSP.join(';'),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-XSS-Protection": "0",
};
// HSTS is ignored on plain HTTP anyway, only send it behind TLS
if (isHttps) HEADERS["Strict-Transport-Security"] = "max-age=15552000; includeSubDomains";

var app = express();
app.disable('x-powered-by');

app.use(function(req, res, next) {
  res.set(HEADERS);
  next();
});
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(express.json({ limit: '2kb' }));

// Requests a token from the Spotify Accounts service
async function requestToken(params) {
  var response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': basicAuth
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error('Token request failed with status ' + response.status);
  }
  return response.json();
}

app.get('/login', function(req, res) {
  var state = crypto.randomBytes(16).toString('hex');
  res.cookie(stateKey, state, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000
  });

  res.redirect('https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', async function(req, res) {
  var code = typeof req.query.code === 'string' ? req.query.code : null;
  var state = typeof req.query.state === 'string' ? req.query.state : null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  res.clearCookie(stateKey);

  if (!code || !state || state !== storedState) {
    return res.redirect('/#' + new URLSearchParams({ error: 'state_mismatch' }));
  }

  try {
    var body = await requestToken({
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code'
    });
    // Tokens are passed in the URL fragment, which is never sent to the server.
    // The frontend removes it from the address bar right away.
    res.redirect('/#' + new URLSearchParams({
      access_token: body.access_token,
      refresh_token: body.refresh_token
    }));
  } catch (err) {
    console.error(err.message);
    res.redirect('/#' + new URLSearchParams({ error: 'invalid_token' }));
  }
});

// POST instead of GET so the refresh token does not end up in proxy access logs
app.post('/refresh_token', async function(req, res) {
  var refresh_token = req.body && req.body.refresh_token;
  if (typeof refresh_token !== 'string' || !refresh_token) {
    return res.status(400).send({ error: 'missing_refresh_token' });
  }

  try {
    var body = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    });
    res.set('Cache-Control', 'no-store');
    res.send({
      access_token: body.access_token,
      // Spotify only sometimes rotates the refresh token
      refresh_token: body.refresh_token || refresh_token
    });
  } catch (err) {
    console.error(err.message);
    res.status(401).send({ error: 'invalid_refresh_token' });
  }
});

app.listen(port, listen_host, function() {
  console.log('Listening on ' + listen_host + ':' + port);
}).on('error', function(err) {
  console.error('Error in server setup: ' + err.message);
  process.exit(1);
});
