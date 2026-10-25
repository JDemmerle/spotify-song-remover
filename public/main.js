(function() {
  'use strict';

  var REFRESH_KEY = 'spotify_refresh_token';

  var loginView = document.getElementById('login');
  var appView = document.getElementById('loggedin');
  var statusEl = document.getElementById('status');
  var removeBtn = document.getElementById('remove-song-from-playlist');
  var nextBtn = document.getElementById('next-song');

  var access_token = null;
  var refresh_token = null;

  function setStatus(text) {
    statusEl.textContent = text;
    statusEl.title = text;
  }

  function storage(action, value) {
    // sessionStorage can be blocked (private mode, disabled site data)
    try {
      if (action === 'get') return sessionStorage.getItem(REFRESH_KEY);
      if (action === 'set') sessionStorage.setItem(REFRESH_KEY, value);
      if (action === 'remove') sessionStorage.removeItem(REFRESH_KEY);
    } catch (e) {}
    return null;
  }

  function showLogin() {
    storage('remove');
    access_token = refresh_token = null;
    appView.hidden = true;
    loginView.hidden = false;
  }

  function ApiError(status, message) {
    this.status = status;
    this.message = message;
  }

  async function refreshAccessToken() {
    if (!refresh_token) throw new ApiError(401, 'Kein Refresh-Token');
    var response = await fetch('/refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh_token })
    });
    if (!response.ok) throw new ApiError(401, 'Token konnte nicht erneuert werden');
    var data = await response.json();
    access_token = data.access_token;
    refresh_token = data.refresh_token;
    storage('set', refresh_token);
  }

  // Spotify-API request helper, renews the access token once on 401
  async function spotifyRequest(endpoint, method, data, retried) {
    var response = await fetch('https://api.spotify.com/v1/' + endpoint, {
      method: method || 'GET',
      headers: Object.assign(
        { 'Authorization': 'Bearer ' + access_token },
        data ? { 'Content-Type': 'application/json' } : {}
      ),
      body: data ? JSON.stringify(data) : undefined
    });

    if (response.status === 401 && !retried) {
      await refreshAccessToken();
      return spotifyRequest(endpoint, method, data, true);
    }
    var body = await parseJson(response);
    if (!response.ok) {
      var message = (body && body.error && body.error.message) || response.statusText || 'Fehler';
      console.error((method || 'GET') + ' ' + endpoint + ' → ' + response.status, body);
      throw new ApiError(response.status, message + ' (' + response.status + ' bei ' + endpoint + ')');
    }
    return body;
  }

  // Player commands (e.g. me/player/next) answer with an empty or non-JSON body
  async function parseJson(response) {
    var text = await response.text().catch(function() { return ''; });
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async function getCurrentSong() {
    var playback = await spotifyRequest('me/player/currently-playing');
    if (!playback || !playback.item) return null;
    var item = playback.item;
    var context = playback.context;
    return {
      uri: item.uri,
      name: item.name,
      artists: (item.artists || []).map(function(a) { return a.name; }).join(', '),
      playlistID: context && context.type === 'playlist' ? context.uri.split(':').pop() : null
    };
  }

  function songLabel(song) {
    return song.artists ? song.name + ' – ' + song.artists : song.name;
  }

  async function showCurrentSong() {
    var song = await getCurrentSong();
    setStatus(song ? 'Läuft: ' + songLabel(song) : 'Aktuell läuft kein Song');
  }

  function handleError(error) {
    console.error('Fehler:', error);
    if (error && error.status === 401) {
      showLogin();
      return;
    }
    setStatus('Fehler: ' + ((error && error.message) || 'Unbekannter Fehler'));
  }

  // Prevents double taps from deleting or skipping twice
  function withLock(action) {
    return async function() {
      removeBtn.disabled = nextBtn.disabled = true;
      try {
        await action();
      } catch (error) {
        handleError(error);
      } finally {
        removeBtn.disabled = nextBtn.disabled = false;
      }
    };
  }

  async function skipToNextSong() {
    await spotifyRequest('me/player/next', 'POST');
  }

  removeBtn.addEventListener('click', withLock(async function() {
    var song = await getCurrentSong();
    if (!song) {
      setStatus('Aktuell läuft kein Song');
      return;
    }
    if (!song.playlistID) {
      setStatus('Der Song läuft nicht aus einer Playlist');
      return;
    }

    try {
      await spotifyRequest('playlists/' + song.playlistID + '/items', 'DELETE', {
        items: [{ uri: song.uri }]
      });
    } catch (error) {
      if (error.status === 403 || error.status === 404) {
        setStatus('Diese Playlist gehört dir nicht und kann nicht bearbeitet werden');
        return;
      }
      throw error;
    }

    await skipToNextSong();
    setStatus('Entfernt: ' + songLabel(song));
  }));

  nextBtn.addEventListener('click', withLock(async function() {
    await skipToNextSong();
    // Spotify needs a moment until the new song is reported as playing
    setTimeout(function() {
      showCurrentSong().catch(function(error) {
        console.warn('Aktueller Song konnte nicht geladen werden:', error);
        setStatus('Nächster Song');
      });
    }, 500);
  }));

  async function initializeApp() {
    var params = new URLSearchParams(window.location.hash.substring(1));

    // Remove tokens from the address bar and browser history
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (params.get('error')) {
      showLogin();
      alert('Es gab einen Fehler während der Authentifizierung!');
      return;
    }

    access_token = params.get('access_token');
    refresh_token = params.get('refresh_token') || storage('get');

    if (!access_token && !refresh_token) {
      showLogin();
      return;
    }
    if (refresh_token) storage('set', refresh_token);

    loginView.hidden = true;
    appView.hidden = false;

    try {
      if (!access_token) await refreshAccessToken();
      await showCurrentSong();
    } catch (error) {
      handleError(error);
    }
  }

  initializeApp();
})();
