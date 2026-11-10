# Contact forms and email

## A form on the site

In the editor's **Add** tab there are **Contact** sections that already include a form. Or you can build one by hand: a container with **form fields** inside (key **K**) and a button.

Field types: short text, email, phone, long message, choice from a list (one choice per line), checkbox, **file attachment**. Any field can be required.

The form is sent without reloading the page, and it works even in browsers without JavaScript. The server checks everything again: if a required field is empty, an email address isn't valid, or a file is the wrong type, the reason appears next to the field.

### Form settings

Select the form's container. In the inspector, under **Contact form**, you find:

- **Name**: how you recognize it among your messages, for example "Contact" or "Quote".
- **Subject** of the email you receive, and **After sending**, the message the sender sees.
- **Send to**: one or more addresses separated by commas. If empty, messages go to the recipient set in Settings → Email.
- **Automatic reply to the sender**: an email with your own subject and text, sent to the address written in the form. It never repeats what was sent.
- **Webhook**: every message also goes to this address, as JSON, so you can connect it to Zapier, Make, n8n, or a CRM.

Only an administrator can change **Send to**, **Webhook** and the **automatic reply**, because they decide where the senders' data ends up and what goes out in the site's name. The webhook must be a public address: Materialize refuses addresses of the internal network (for example `127.0.0.1` or `192.168.…`). For n8n or another service on the same server, start it with `MATERIALIZE_PRIVATE_WEBHOOKS=1`.

### File attachments

The **File attachment** field accepts documents (PDF, Word, Excel, OpenDocument, text), images (JPG, PNG, WebP, HEIC), or both, up to 10 MB per file. Files stay private: they aren't in the media library and can't be reached from the site. You download them by opening the message, and the email tells you they are there.

### Privacy consent

Add a **Checkbox** field, make it required, and give it a label such as "I have read the privacy policy". In the **Link** field, enter the address of the privacy policy page (for example `/privacy`): the label opens it in a new tab.

## Spam

Materialize stops spam without CAPTCHA, so it doesn't waste the time of people who are really writing to you:

- a **hidden field** that only bots fill in: these messages are thrown away;
- a form filled in in **less than 3 seconds**;
- messages with **more than three links** or with **hidden links** in the text;
- the **same message** arriving twice on the same day;
- at most **5 submissions per minute** from the same address.

Except for those caught by the hidden field, suspicious messages go to the **Spam** folder in Settings → Messages, with the reason. They don't arrive by email and aren't sent to the webhook. If a message ended up there by mistake, the shield button puts it back with your messages.

## Where messages arrive

- Always in **Settings → Messages**, with the number of unread messages next to the menu item. Here you can filter them by form, **Unread**, or **Spam**, search them by word, and export them to a spreadsheet with **CSV** (it opens in Excel, Numbers, or Google Sheets).
- By **email** too, if sending email is set up (see below).
- At the form's **webhook**, if you entered one.

### How long they're kept

At the bottom of Settings → Messages, choose whether to automatically delete messages older than **6 months**, **1 year**, or **2 years**, along with their attachments. The GDPR asks you to keep personal data only as long as you need it.

### Webhook, for developers

The webhook receives a `POST` with a JSON body: `id`, `form` (`id` and `name`), `page`, `data` (the fields), `files` (name and size of the attachments, which stay in the panel), and `createdAt`. The `X-Materialize-Signature: sha256=…` header is the HMAC SHA-256 of the body, computed with the **webhook key** shown to administrators in Settings → Messages. Compare it to be sure the call comes from your site. If the receiver doesn't respond, Materialize tries again twice over the next few minutes, and the message shows whether the webhook failed.

## Setting up email

An administrator sets it up in **Settings → Email**. You need an outgoing mail server (SMTP): the one for your mailbox, or one from a service such as Brevo, Postmark, or Amazon SES.

**Your provider**: choose it from the list (Brevo, Postmark, Resend, Mailgun, Amazon SES, SendGrid, Mailjet, SMTP2GO, Aruba, Register.it, Gmail, Microsoft 365). Server, port, and security fill in by themselves, and below **User** and **Password** you see where to find them in the provider's dashboard. If yours isn't listed, choose **Other** and enter the details by hand.

| Field                     | What to enter                                                               |
| ------------------------- | --------------------------------------------------------------------------- |
| **Server**                | for example `smtp.example.com`, found in your provider's instructions       |
| **Port** and **Security** | usually 587 with STARTTLS, or 465 with TLS                                  |
| **User** and **Password** | those of your mailbox or service                                            |
| **Sender**                | how it appears to recipients, for example `Smith Studio <site@example.com>` |
| **Form recipient**        | where the site's messages arrive                                            |

**Save and send a test** checks right away that it works. If it doesn't, the panel tells you why and what to do:

- **the server doesn't exist**: a typo in the name;
- **the server doesn't respond on the port**: VPS providers often block outgoing mail ports. The panel tries the other ports by itself and tells you which one responds. Otherwise, ask your VPS support to unblock them, or use a service that accepts port 2525;
- **the security doesn't match the port**: 587 with STARTTLS, 465 with TLS;
- **user or password rejected**: with a reminder of where to find them;
- **sender not accepted**: it must be verified with the provider;
- **sending deferred**: often a message limit has been reached.

## Keeping your email out of spam

**Check the domain** reads the DNS of the sender's domain, just as Gmail, Outlook, and others do before trusting a message:

- **SPF** says which servers can send for the domain. The panel checks that there is one, that there aren't two (they cancel each other out), and that it authorizes your provider;
- **DKIM** signs messages. For many providers the panel looks it up by itself. For others (Postmark, Amazon SES, SMTP2GO) the names change for each account, so you check it in their dashboard;
- **DMARC** says what to do with messages that don't pass. Gmail and Yahoo require it from senders of large volumes of email. To start, a record that only monitors is enough.

You add these records in your domain's DNS settings, as your mail provider tells you. Changes can take a few hours to take effect.

## What changes once email is set up

Besides form messages, these arrive by mail:

- **invitations** for new people and links for a **new password**, instead of having to copy and send them by hand;
- **security alerts**: failed sign-in attempts, a changed profile email.

Materialize works without email too, but email is recommended: **Settings → Security** points it out until it's set up.
