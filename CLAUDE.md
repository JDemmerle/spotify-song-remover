# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Small web app: one button removes the currently playing Spotify track from the playlist it is playing from, then skips to the next track. No build step, no tests, no linter. Requires Node.js >= 18 (uses native `fetch`).

## Commands

```bash
npm install
SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx npm start   # serves on 127.0.0.1:8888
```

Environment variables (read in `app.js`):
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` — from https://developer.spotify.com/dashboard (required, server exits without them)
- `SPOTIFY_REDIRECT_URL` — defaults to `http://127.0.0.1:8888/callback`; must match the Spotify dashboard. Spotify rejects `localhost`; only HTTPS or loopback IPs are allowed. An `https://` value also enables HSTS and `upgrade-insecure-requests`.
- `LISTEN_HOST` — bind IP, defaults to `127.0.0.1`. Port 8888 is hardcoded.

Production runs as a systemd service behind an Apache reverse proxy (TLS); full config examples are in `README.md`.

## Architecture

- **`app.js`** (Express backend) — only handles the Spotify OAuth2 Authorization Code flow so the client secret stays on the server:
  - `/login` → redirects to Spotify authorize with an httpOnly `state` cookie
  - `/callback` → exchanges the code for tokens, then redirects to `/#access_token=...&refresh_token=...`
  - `POST /refresh_token` (JSON body `{refresh_token}`) → returns a new access token
  - Serves `public/` statically; security headers incl. a strict CSP are set on every response.
- **`public/main.js`** — reads tokens from the URL hash, removes them via `history.replaceState`, keeps the access token in memory and the refresh token in `sessionStorage`. Calls the Spotify Web API **directly from the browser** (`spotifyRequest()`, auto-refreshes once on 401).
- **`public/index.html` / `style.css`** — login view and main view (status line + two buttons filling the viewport via flexbox/`dvh`, side by side in landscape).

Main flow on "remove" click: `GET me/player/currently-playing` → `DELETE playlists/{id}/items` (body `{items: [{uri}]}`) → `POST me/player/next`. Spotify renamed the playlist `/tracks` endpoints to `/items` in Feb/Mar 2026; the old ones return 403. 403/404 on delete means the playlist is not owned by the user (or Spotify-generated).

## Notes

- The CSP is `script-src 'self'`, `style-src 'self'`, `connect-src 'self' https://api.spotify.com`: no inline scripts/styles, no CDNs. Adding external resources requires changing `CSP` in `app.js`.
- UI strings and console messages are in German.
- Code style: CommonJS, `var`, no frameworks or frontend dependencies — keep consistent.
