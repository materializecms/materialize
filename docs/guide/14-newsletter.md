# Newsletter

Materialize collects subscribers from your site and sends the newsletter with the email you already set up in **Settings → Email**. There are no outside services to connect: your subscribers stay on your site.

## Collecting subscribers

In the editor, on the **Add** tab, there are two ready-made sections with a sign-up form: **Call to action → Newsletter** and **Footer → With sign-up**. They have an email field, a consent checkbox and a **Subscribe** button.

Any form can become a sign-up form: select it, and in the right-hand panel, under **Contact form**, turn on **Signs up to the newsletter**. It needs a field of type Email. A required checkbox for privacy consent is a good idea.

- **Double opt-in**: people who sign up get an email with a link. Only after they open it do they become **Active**; until then they are **Unconfirmed**. This is what the GDPR asks for, and it keeps out addresses typed by someone else or by mistake. Unconfirmed sign-ups disappear after a week.
- **Spam protection**: the same as for forms, with no CAPTCHA.
- Sign-ups don't go to **Messages**: you find them in **Newsletter → Subscribers**.

## Subscribers

In **Newsletter → Subscribers** you see everyone, with the **Active**, **Unconfirmed** and **Unsubscribed** filters, and search.

- **Add**: type an address and that person gets an email to confirm. They have to give consent themselves.
- **Import CSV**: for people coming from Mailchimp, Brevo or a spreadsheet. Materialize finds the email column (and the name, if there is one). Imported subscribers are active right away, because they gave consent there. Anyone who unsubscribed here stays out.
- **Export**: the whole list as CSV, whenever you want.
- The trash can next to a subscriber deletes their data. Use it when someone asks to be forgotten.

Adding, importing, exporting and deleting are for administrators only.

## Writing a newsletter

**Newsletter → New newsletter** offers three starting points:

- **Blank**: write from scratch.
- **From an article**: pick a published entry. Its title becomes the subject, its summary the preview text, and the body holds the text and a **Read it on the site →** link.
- **Written by AI**: if AI is set up, it drafts a newsletter from the last three posts, in your [brand voice](09-ai-and-mcp.md#brand-voice), with a link to each one. It uses only the facts in the posts.

Then write the **subject**, the **preview** (the line many mail apps show after the subject) and the **text**, with headings, lists, bold, links and images. It saves by itself.

## Testing and sending

- **Send a test**: the newsletter goes to you, or to the address you type, with "[Prova]" before the subject. It doesn't count in the stats.
- **Send now**: it goes out to all active subscribers, one email at a time, so the mail service doesn't block it. Once it has started, you can't edit it anymore.
- **Schedule**: pick a day and time, just like for a page. It goes to whoever is subscribed at that moment. If the server is off at that time, it goes out as soon as the server is back. If it stops halfway through sending, it picks up where it left off.

At the bottom of every email there is a link to **unsubscribe** and the sender's details, which an administrator enters once in **Newsletter → Settings** (the **Sender** block): in many countries the law requires the sender's name and address. Mail apps like Gmail also show their own "Unsubscribe" button, which works in one click.

## Stats

For each newsletter sent, you see how many emails went out, the **Opens** and **Clicks** rates, and how many people unsubscribed.

- Opens are counted with an invisible image. They're an estimate, because some apps block images and others open them automatically.
- Clicks go through your site, which then takes people to the real address. The links are signed, so nobody can use them to send people somewhere else.
- You can turn stats off in **Newsletter → Subscribers → Settings**. If you keep them on, mention it in the site's privacy policy.
