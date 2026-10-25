# Spotify song remover

A small web app optimised for phones: one tap removes the currently playing song from the playlist it is playing from and skips to the next song.

- **Lösche Song aus Playlist** – removes the current song from the playlist and plays the next one
- **Nächster Song** – just skips to the next song
- The status line shows the song that is playing now and the song that was removed last

Songs can only be removed from playlists you own (or collaborate on). Spotify-generated playlists, albums and artist radios cannot be edited.

## Requirements

- Node.js 18 or newer
- Spotify Premium (required by Spotify for skipping songs via the Web API)
- A Spotify app from https://developer.spotify.com/dashboard. Register these redirect URIs in its settings:
  - `http://127.0.0.1:8888/callback` for local development (Spotify no longer accepts `localhost`)
  - `https://example.com/callback` for production (your own domain)

  While the Spotify app is in development mode, every Spotify account that wants to log in has to be added under *User Management*.

## Installation

```bash
npm install
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `SPOTIFY_CLIENT_ID` | yes | – | Client ID of your Spotify app |
| `SPOTIFY_CLIENT_SECRET` | yes | – | Client secret of your Spotify app |
| `SPOTIFY_REDIRECT_URL` | no | `http://127.0.0.1:8888/callback` | Must match a redirect URI of the Spotify app. An `https://` URL also enables HSTS. |
| `LISTEN_HOST` | no | `127.0.0.1` | IP the server binds to. The port is always `8888`. |

## Development

```bash
SPOTIFY_CLIENT_ID=xxxxxx SPOTIFY_CLIENT_SECRET=xxxxxx npm start
```

Then open http://127.0.0.1:8888.

## Production (systemd + reverse proxy)

Create a system user that runs the application, in this example `spotify-song-remover`, and clone the repository into its home directory.

Create a systemd service, e.g. `/etc/systemd/system/spotify-song-remover.service`:
```ini
[Unit]
Description=Spotify song remover
Documentation=https://github.com/JDemmerle/spotify-song-remover/blob/main/README.md
After=network.target

[Service]
Environment="SPOTIFY_CLIENT_ID=XXXXX"
Environment="SPOTIFY_CLIENT_SECRET=XXXXX"
Environment="SPOTIFY_REDIRECT_URL=https://example.com/callback"
Type=simple
User=spotify-song-remover
Group=spotify-song-remover
WorkingDirectory=/home/spotify-song-remover/spotify-song-remover
ExecStart=/usr/bin/node /home/spotify-song-remover/spotify-song-remover/app.js
Restart=on-failure
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
```

Since the unit file contains the client secret, make it readable for root only (`chmod 600`). Then enable it:
```bash
systemctl daemon-reload
systemctl enable --now spotify-song-remover
```

Set up a reverse proxy to serve the application via HTTPS on your own domain. Example for Apache 2.4:
```apache
<VirtualHost *:80>
        ServerName      example.com

        Redirect permanent / https://example.com/
</VirtualHost>

<VirtualHost *:443>
        ServerName example.com

        ErrorLog ${APACHE_LOG_DIR}/example.com-error.log
        CustomLog ${APACHE_LOG_DIR}/example.com-access.log combined

        ProxyPreserveHost On
        ProxyPass / http://127.0.0.1:8888/
        ProxyPassReverse / http://127.0.0.1:8888/

        SSLEngine On
        SSLCertificateFile /etc/acme.sh/certs/example.com/example.com.cer
        SSLCertificateKeyFile /etc/acme.sh/certs/example.com/example.com.key
        SSLCertificateChainFile /etc/acme.sh/certs/example.com/ca.cer
</VirtualHost>
```

### Updating

```bash
git pull
npm install
systemctl restart spotify-song-remover
```

Changes that only touch files in `public/` need no restart, reloading the page is enough.

## How it works

The Node.js backend (`app.js`) only handles the Spotify login (OAuth2 Authorization Code flow), so the client secret never leaves the server. The page in `public/` then calls the Spotify Web API directly from the browser. The access token is only kept in memory and the refresh token in the browser's `sessionStorage`, so you have to log in again after closing the tab.
