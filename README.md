# Spotify song remover

This app removes the current playing song from the currently playing playlist.

## Installation

Install the app dependencies running:
```bash
npm install
```

## Using your own credentials

During development:
```bash
SPOTIFY_CLIENT_ID=xxxxxx SPOTIFY_CLIENT_SECRET=xxxxxx npm start dev
```

Running productive (use systemd)
```bash
SPOTIFY_CLIENT_ID=xxxxxx SPOTIFY_CLIENT_SECRET=xxxxxx SPOTIFY_REDIRECT_URL=https://example.de/callback npm start dev
```
