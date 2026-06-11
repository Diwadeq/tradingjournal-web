// Google Drive layer — talks to the same TradingJournalSync/journal.db the
// iPhone app uses. OAuth via Google Identity Services token client (PKCE-free,
// browser-only; access tokens last ~1h and are silently refreshed).
const Drive = {
  token: null,
  expiry: 0,
  tokenClient: null,
  folderId: null,
  fileIds: {},   // file name → Drive file id (journal.db, backtest.db, …)

  init() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPE,
      callback: () => {},
    });
    try {
      const saved = JSON.parse(sessionStorage.getItem('tj_token') || 'null');
      if (saved && saved.expiry > Date.now() + 60000) {
        this.token = saved.token;
        this.expiry = saved.expiry;
      }
    } catch (e) { /* ignore */ }
  },

  requestToken(prompt) {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        this.token = resp.access_token;
        this.expiry = Date.now() + (resp.expires_in - 60) * 1000;
        sessionStorage.setItem('tj_token', JSON.stringify({ token: this.token, expiry: this.expiry }));
        resolve();
      };
      this.tokenClient.error_callback = (e) => reject(new Error(e.type || 'popup_closed'));
      this.tokenClient.requestAccessToken({ prompt });
    });
  },

  async ensureToken() {
    if (this.token && this.expiry > Date.now()) return;
    await this.requestToken(''); // silent if previously granted
  },

  signOut() {
    if (this.token) { try { google.accounts.oauth2.revoke(this.token); } catch (e) {} }
    this.token = null;
    this.expiry = 0;
    sessionStorage.removeItem('tj_token');
  },

  async api(url, opts = {}) {
    await this.ensureToken();
    opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${this.token}` };
    let resp = await fetch(url, opts);
    if (resp.status === 401) {
      this.token = null;
      await this.ensureToken();
      opts.headers.Authorization = `Bearer ${this.token}`;
      resp = await fetch(url, opts);
    }
    if (!resp.ok) throw new Error(`Drive API ${resp.status}`);
    return resp;
  },

  async findOrCreateFolder() {
    if (this.folderId) return this.folderId;
    const q = encodeURIComponent(`name='${CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const resp = await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    const json = await resp.json();
    if (json.files && json.files.length) {
      this.folderId = json.files[0].id;
      return this.folderId;
    }
    const create = await this.api('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: CONFIG.FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    const created = await create.json();
    this.folderId = created.id;
    return this.folderId;
  },

  // Drop the cached file id so the next call re-resolves it (a DB created on
  // another device since our last look-up is then found).
  forget(name) { delete this.fileIds[name]; },

  async findFile(name) {
    const folderId = await this.findOrCreateFolder();
    const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
    const resp = await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`);
    const json = await resp.json();
    this.fileIds[name] = (json.files && json.files.length) ? json.files[0].id : null;
    return this.fileIds[name];
  },

  // Returns Uint8Array of the remote DB file, or null if it doesn't exist.
  async download(name) {
    const id = await this.findFile(name);
    if (!id) return null;
    const resp = await this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    const buf = new Uint8Array(await resp.arrayBuffer());
    // verify SQLite magic so a bad response can never corrupt anything
    const magic = 'SQLite format 3';
    for (let i = 0; i < magic.length; i++) {
      if (buf[i] !== magic.charCodeAt(i)) throw new Error('Downloaded file is not a valid database');
    }
    return buf;
  },

  async upload(name, bytes) {
    const id = await this.findFile(name);
    if (id) {
      await this.api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
      });
    } else {
      const folderId = await this.findOrCreateFolder();
      const boundary = crypto.randomUUID();
      const meta = JSON.stringify({ name, parents: [folderId] });
      const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const tail = `\r\n--${boundary}--`;
      const body = new Blob([head, bytes, tail]);
      await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
    }
  },
};
