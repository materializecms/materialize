# Troubleshooting

## Installation

**The site doesn't open over HTTPS after installing.**
The certificate only arrives once the domain points to the server and ports 80 and 443 are open, including in the VPS provider's firewall (some providers have one in their dashboard). Check the domain's A record. If you use Cloudflare, keep the cloud gray until the certificate is ready. To see what's going on: `journalctl -u caddy -f`.

**I lost the installation link.**
On a VPS, run the install command again: it prints the link again without changing anything. With Docker: `docker compose logs materialize`.

**The script says the system isn't supported.**
You need Debian 12 or Ubuntu 22.04, or newer, on x86_64 or arm64 processors, with at least 1 GB of memory.

## Everyday use

**I edited a page but the site doesn't change.**
Changes are a draft until you click **Publish** (or **Publish changes**). After that, the site rebuilds in a few seconds. If you still don't see them, reload the site's page.

**I can't publish.**
Something required is missing: the panel points it out and takes you to the field. If the button isn't there at all, you're an editor on a site where editors change content only, or you don't have permission. Ask an administrator.

**An editor doesn't see Design mode.**
**Editors change content only** is turned on in **People**.

**Form messages don't arrive by email.**
Check **Settings → Email** with **Save and send a test**. Messages are still kept in **Settings → Messages**.

**Sign-in is blocked after a few attempts.**
This is the protection against people trying to guess passwords. Wait for the time shown, an hour at most.

**I lost the phone with my two-step verification app.**
Sign in with one of the **backup codes** you saved. If you don't have them, another administrator can turn off your two-step verification from **People**.

**I forgot my password.**
Use **Forgot your password?** on the sign-in page, if email is set up. Otherwise, ask an administrator, or use the `materialize reset-password` command on the server: see [People and security](08-people-and-security.md#if-you-forget-your-password).

## Updates

**Settings → Updates says you can't update from here.**
The site wasn't started with the VPS script or with Docker, or it's in development. The panel shows the command to run by hand.

**An update failed.**
If the new version doesn't start, Materialize goes back to the previous version by itself, and the panel shows the reason, with details. The site loses nothing.

## Seeing what's happening on the server

On a VPS installed with the script:

```bash
systemctl status materialize       # is it running?
journalctl -u materialize -f       # the log, live
journalctl -u caddy -f             # HTTPS and certificate
```

With Docker: `docker compose logs -f materialize`.

## Still stuck?

Open an issue on [GitHub](https://github.com/materializecms/materialize/issues), describing what you did, what you expected and what happened. **Don't paste passwords, keys or tokens.**
