# Spotify song remover

This app removes the current playing song from the currently playing playlist by simply touch a button on a website (included in this project)

## Installation

Install the app dependencies running:
```bash
npm install
```

## Using your own credentials

### During development
```bash
SPOTIFY_CLIENT_ID=xxxxxx SPOTIFY_CLIENT_SECRET=xxxxxx npm start dev
```

### Running productive (use systemd)
Create a specific system user which runs the application. In this example it's simply called `spotify`.

Create a systemd service:
```bash
[Unit]
Description=Spotify song remover
Documentation=https://github.com/JDemmerle/spotify-song-remover/blob/main/README.md
After=network.target

[Service]
Environment="SPOTIFY_CLIENT_ID=XXXXX"
Environment="SPOTIFY_CLIENT_SECRET=XXXX"
Environment="SPOTIFY_REDIRECT_URL=https://example.com/callback"
Type=simple
User=spotify-song-remover
Group=spotify-song-remover
ExecStart=/usr/bin/node /home/spotify/spotify-song-remover/app.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
Replace `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` with the IDs from https://developer.spotify.com/dashboard (create a new app).

The service is always listening on localhost:8888 but you can also set the env variable `LISTEN_HOST` to change the bind ip.

Setup a reverse proxy to access your application with a certificate and a custom url.
The following configuration example is for Apache2.4
```bash
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