# Analytics and cookies

In **Settings → Tracking and cookies**, an administrator connects analytics and marketing tools. For the most common ones, the ID is all you need:

| Tool               | What to enter                                                      |
| ------------------ | ------------------------------------------------------------------ |
| Google Analytics 4 | the measurement ID, `G-…`                                          |
| Google Tag Manager | the container ID, `GTM-…`                                          |
| Meta Pixel         | the pixel ID                                                       |
| Plausible          | the domain, as it appears in Plausible (for example `example.com`) |
| Matomo             | your Matomo address and the site ID                                |

For anything else, you can add **Custom code**, in the `<head>` or at the end of the page, and choose what it's for: **Necessary**, **Analytics** or **Marketing**.

The code goes on every published page, never in the editor preview, so your own work visits don't end up in your analytics.

## The cookie banner

When there is analytics or marketing code, the site shows a banner by itself, with **Reject**, **Customize** and **Accept all**.

- Until the visitor accepts, that code stays off. With Google, Consent Mode starts as "denied".
- The choice lasts one year.
- Visitors can change it from the small button at the bottom left, or from a link to `#preferenze-cookie` that you can put in the footer, for example ("Cookie preferences").

**Necessary** code always runs, without asking. Use it only for what the site truly needs.

## What's left for you to do

Materialize handles consent, but your **privacy policy and cookie policy** must be written for your site, with a professional or a dedicated service, and published as pages.

Fonts are covered too: Materialize serves Google Fonts from your own site, so visitors don't contact Google to download them.
