**English** · [Italiano](sicurezza.md)

# Putting Materialize online securely

Materialize protects the panel on its own:
- limits on failed sign-ins, per email and per address;
- two-step verification and passkeys;
- browser security rules (CSP) on the panel;
- an activity log;
- daily database backups.

Some things, though, are up to whoever puts it online. This guide lists them in the order to do them.

Your site's status is in **Settings → Security**: each point to fix has its own button.

## 1. HTTPS

Serve the panel over HTTPS only, otherwise passwords and sessions travel in clear text. The simplest ways:

- **Hosting with HTTPS included** (Render, Railway, Fly.io, a VPS with a control panel): turn it on in its settings.
- **Caddy** in front of Materialize: it gets and renews Let's Encrypt certificates by itself.
- **Cloudflare** (see below): set encryption to _Full (strict)_, not _Flexible_.

In the configuration, set the public address. SEO, the sitemap and passkeys need it too:

```ts
site: { name: 'Studio Rossi', url: 'https://www.example.com' },
```

## 2. Behind a proxy: `trustProxy`

Materialize almost always sits behind something that receives requests for it: Cloudflare, Nginx, Caddy, or the hosting's load balancer. Then every request seems to come from the proxy's address. The real address of whoever connects is in the `X-Forwarded-For` header.

Tell Materialize to read it:

```ts
// materialize.config.ts
export default defineConfig({
  // …
  server: { port: 4321, trustProxy: true },
})
```

- **With a proxy and `trustProxy` off**, the per-address limits see a single address, the proxy's. Twenty mistakes by anyone block everyone.
- **Without a proxy and `trustProxy` on**, anyone can write a false address in the header and get around those limits.

Settings → Security warns you in both cases.

Each proxy adds the address it saw at the end of the header, and whatever comes before can be written by anyone: Materialize reads it from the right. With one proxy (Docker with Caddy, the VPS, Nginx) `true` is enough; with two proxies in a row, for example Cloudflare in front of Caddy, set `trustProxy: 2` (or `MATERIALIZE_TRUST_PROXY=2`).

### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name www.example.com;
  # certificates: certbot --nginx

  client_max_body_size 30m;   # image uploads up to 25 MB

  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    # the AI assistant streams its answers (server-sent events)
    proxy_buffering off;
  }
}
```

Note `X-Forwarded-For $remote_addr`, not `$proxy_add_x_forwarded_for`. This way Nginx writes the address it really sees and doesn't add the one the visitor claims.

### Caddy

```caddy
www.example.com {
  reverse_proxy 127.0.0.1:4321
}
```

Caddy sets up HTTPS and `X-Forwarded-For` by itself.

## 3. Cloudflare

With the domain on Cloudflare, traffic goes through its servers before reaching yours. Many attacks stop there, before they use up resources.

1. **SSL/TLS → Overview**: _Full (strict)_. The server needs a valid certificate; a Cloudflare _Origin Certificate_ is fine too.
2. **SSL/TLS → Edge Certificates**: turn on _Always Use HTTPS_ and _HSTS_.
3. **Security → WAF → Rate limiting rules**: a rule for sign-in attempts, as a second line of defense beyond Materialize's own limits:
   - _URI Path_ equals `/api/auth/login`, method `POST`;
   - 10 requests in 1 minute per address → _Block_ for 10 minutes.
4. **Security → Bots**: _Bot Fight Mode_ on.
5. **Caching → Cache Rules**: exclude `/admin*` and `/api*` from the cache. Materialize already answers with `no-store`, but an explicit rule avoids surprises.
6. On the server, accept connections from Cloudflare only: [list of addresses](https://www.cloudflare.com/ips/), in the firewall or in the Nginx configuration. Otherwise anyone can get around Cloudflare by calling the server's address directly.

With Cloudflare in front, set `trustProxy: true` in `materialize.config.ts`. With Nginx behind Cloudflare, instead of `$remote_addr` use the `real_ip` module with Cloudflare's addresses and the `CF-Connecting-IP` header.

## 4. Server firewall

On a VPS, leave open only the ports you need:

```bash
ufw default deny incoming
ufw allow 22/tcp     # SSH (better with keys, without passwords)
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Materialize's port (4321) must not be reachable from outside: only the proxy reaches it, locally.

## 5. People and access

- Turn on **two-step verification** for yourself, or add a **passkey** (Your profile → Security). Then require it of everyone, from **People**: a passkey counts as the second step.
- Set up **sending email** (Settings → Email). People then get notices about failed attempts and address changes, and new-password links arrive by themselves.
- Give the administrator role only to people who must manage people, settings and custom code. Everyone else only needs the editor role.
- Now and then, look at Settings → Activity log, and at the tokens in Settings → AI and MCP: revoke the ones you no longer need.

## 6. Backups

Every day the server saves to the `backups` folder, next to the database (for example `.materialize/backups`):

- **a copy of the database**. It keeps the last 14 copies; the number can be changed in Settings → Backups;
- **a copy of the images** in `backups/media`. It adds only new files, because an uploaded original never changes. Resized versions aren't needed: the server makes them again. An image deleted from the library stays in the copy for at least 30 days, and in any case as long as there is a database backup older than the deletion.

These copies live on the same server: if the server breaks, they're lost with it. The recommended solution is the **off-server copy**, in Settings → Backups: every night the backups go, encrypted, to S3-compatible storage or a WebDAV folder. How to turn it on and how to restore backups is explained in the [guide](guide/12-updates-and-backups.md#off-server-copy).

There's also **Download everything**: a single `.tar.gz` archive with the database, all the original images and the fonts. It's built while you download it, so it takes no space on the server even with many GB. Keep a copy somewhere else, for example on your computer or in a cloud.

Alternatively, an automatic copy from another computer:

```bash
# every night
rsync -a server:/srv/site/.materialize/backups/ ~/site-backup/
```

To restore a backup, stop the server and, in the site's folder:

```bash
# a copy of the database: missing images come back from backups/media
npx materialize restore .materialize/backups/content-20261030-031500-auto.db

# or the full archive: database, images and fonts
npx materialize restore ~/Downloads/materialize-2026-10-30.tar.gz
```

Before it's replaced, the current database is itself saved among the backups. So a restore can be undone too. The archive also serves to move the site to another server: install Materialize and, on the first installation screen, upload the archive; or, on a site that's already installed, Settings → Backups → Restore from an archive. The server checks the archive (complete, made by Materialize, not from a newer version) before replacing anything. Uploading is for administrators only, or for whoever has the installation link.

With a hosted database (Turso, libSQL), the provider makes the database backups: check that they're on in its dashboard. The full archive still contains images and fonts.

## 7. Updates

- **Update Materialize:** security fixes arrive with new versions.
- **Check the dependencies:** `npm run audit` looks for known vulnerabilities. In the Materialize repository, GitHub does it every week too (`.github/workflows/check.yml`), and Dependabot proposes the updates.
- **Update Node.js:** use a version that's still supported (Materialize needs Node 24 or later).

## What Materialize already does

| Protection                                                                                         | Where                         |
| -------------------------------------------------------------------------------------------------- | ----------------------------- |
| Passwords hashed with scrypt                                                                       | always                        |
| A pause after 5 mistakes per email and 20 per address, doubling up to an hour                      | always, saved in the database |
| Two-step verification (authenticator app) and backup codes                                         | Your profile → Security       |
| Passkeys (Face ID, Touch ID, Windows Hello, security keys), bound to the site's address            | Your profile → Security       |
| Sessions that expire after 14 days of inactivity, a list of devices                                | Your profile → Security       |
| Email notices: failed attempts, address changes, verification turned off                           | with email set up             |
| Browser rules (CSP) on the panel: no foreign scripts, data sent only to its own server             | always                        |
| CSRF protection, `HttpOnly` and `SameSite` session cookies                                         | always                        |
| Custom code only from administrators, in an isolated preview                                       | always                        |
| Analytics and marketing scripts held until the visitor consents                                    | Settings → Tracking           |
| Images reloaded and converted again; internal addresses blocked when importing an image from a URL | always                        |
| Saved pages cleaned before becoming HTML: no scripts from tags, CSS, components or SVG             | always                        |
| Form webhooks only to public addresses (`MATERIALIZE_PRIVATE_WEBHOOKS=1` for a local service)      | always                        |
| Visitor comments: spam checks without CAPTCHA, approval before they show, no IP saved              | Settings → Comments           |
| Size limits on requests, and on form messages per address                                          | always                        |
| Activity log, kept for a year                                                                      | Settings → Activity log       |
| Daily database backups                                                                             | Settings → Backups            |
