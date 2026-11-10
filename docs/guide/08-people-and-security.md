# People and security

## Roles

| Role              | What they can do                                              |
| ----------------- | ------------------------------------------------------------- |
| **Administrator** | Everything, including people, settings, updates and deletions |
| **Editor**        | Create, edit and publish content                              |

There is always at least one administrator: you can't remove or demote the last one.

**Editors change content only**: with this switch, in **People**, editors can change text and images but not the layout. The server enforces it too, not just the panel.

## Inviting someone

In **People**, an administrator clicks **Invite someone**, types the email address and picks the role.

- If email is set up, the invitation arrives by mail. If not, the panel shows the link for you to send yourself.
- The link is valid for **7 days** and works only once: whoever opens it chooses a name and a password.

From a person's **⋯** menu, an administrator can change their role, fix their name or email, create a **new-password link** (valid for 24 hours), turn off their two-step verification, or remove their access.

## Your profile

Click the circle with your initial, top right, and open **Your profile**: name, email (you need your current password to change it) and password, at least 10 characters long.

## Two-step verification

On top of your password, you enter a 6-digit code from an app on your phone (Google Authenticator, 1Password, Authy…). Even someone who finds out your password can't get in.

1. Go to **Your profile → Security** and turn on verification.
2. Scan the QR code with the app and type the code it shows.
3. **Save the backup codes** somewhere safe. Each one works once, and you need them if you lose your phone.

An administrator can **Require two-step verification for everyone** (in **People**). Anyone who doesn't have it turns it on at their next sign-in.

On the same tab you see the **devices** signed in to your account, and you can sign them out. A session that goes unused for 14 days closes by itself.

## Automatic protection

- After 5 failed sign-in attempts for the same email, or 20 from the same address, sign-in **pauses for a while**: one minute, then two, four… up to an hour. This also applies to emails that don't exist, so nobody can find out who has an account.
- The panel blocks requests that come from other sites, and protects passwords with an algorithm that is slow to crack.

## Settings → Protection

Three sections, for administrators only:

- **Security**: what needs fixing, for example administrators without two-step verification, email not set up, a site without HTTPS, or failed sign-ins in the last 24 hours. Each item has its own button. When there's nothing to fix, you see **All good.**
- **Backups**: see [Updates and backups](12-updates-and-backups.md).
- **Activity log**: who signed in, who published, invited, changed settings or installed updates, and from where. It's kept for one year.

In **People**, the verification column shows **Two-step** or **Password only** for each person.

## If you forget your password

On the sign-in page, click **Forgot your password?** and type your email. You get a link to choose a new one, valid for **one hour**. If it doesn't arrive, check your spam folder. For security, the page gives the same answer for any address, and after a few requests it pauses for a while. Online, the link is sent only if the site knows its own address (`site.url` or `MATERIALIZE_SITE_URL`); without it, Settings → Security points it out. A password changed with the link ends every open session and revokes the personal access tokens.

This needs email to be set up (see [Contact forms and email](07-forms-and-email.md)). Without it:

- an **administrator** creates the link for you, in **People**, from the **⋯** menu;
- if you're the **only administrator**, whoever manages the server creates it with a command, from the site's folder:

  ```bash
  # on a VPS installed with the script
  cd /srv/materialize && sudo -u materialize node_modules/.bin/materialize reset-password name@example.com

  # with Docker, in the folder with compose.yaml
  docker compose run --rm materialize reset-password name@example.com
  ```

  The command prints the link, valid for one hour.

If you use two-step verification, you still need the code after setting the new password. A new password doesn't skip it.

To secure the server (HTTPS, proxy, firewall), see the [security guide](../sicurezza.md).

## One document at a time

Two people can't edit the same document at once: whoever saved last would wipe out the other's work. So people take turns.

- If you open a page, a post or a settings tab while someone else is editing it, you see a box telling you who is working on it and for how long. You can **Go back**, **Open the site** to look at the published page, or **Take over**.
- **Take over** is for when the other person has walked away or left the tab open. They switch to read-only right away and see who took over. Their changes up to the last save are kept; only the last few seconds of work might be lost. The Activity log records it.
- The turn frees up by itself when the person editing closes the document or the tab, or after less than a minute with no sign of activity.
- This also applies to the same person in two tabs: you edit in one, and the other stays read-only (with **Continue here**).
- The server checks this too: a save from someone who doesn't have the turn is refused with a message instead of overwriting. On different documents, people work together as usual.
