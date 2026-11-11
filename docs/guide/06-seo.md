# SEO

Materialize prepares what search engines need by itself: titles and descriptions, sitemap, `robots.txt`, structured data, social previews, clean addresses, and redirects. Images are light and the site is made of static files, so it's fast.

## For each page

In the editor, the **Checks** tab on the left:

- **checks** on the page: title and description of the right length, sharing image, a single main heading, links to pages that don't exist, and more, together with the accessibility and performance checks (see [Page checks](03-editor.md#page-checks)). When everything is in order, **All good** appears;
- the **title** and **description** that show up on Google, with a preview of how they will look on Google and when the page is shared;
- the **sharing image** for WhatsApp, LinkedIn, Facebook.

The same fields are also in the **Page** panel on the right when nothing is selected.

The AI assistant can suggest a title and description based on the page's content.

## For the whole site

In **Settings → Site** you write once who the site is and how to reach it:

- **Identity**: name, description (Google uses it for pages without their own), logo, site icon; the site's address, which the server decides.
- **Contacts and location**: what it is (company, local business, person), email, phone, address, opening hours. Google uses them for business listings.
- **Social profiles**: one address per line.

Texts and buttons on the pages can show these details: select them on the canvas and choose **Site detail** (name, description, email, phone, address, hours). A button with the email writes to it, one with the phone calls it. Change the detail in Settings → Site and it updates on every page.

In **Settings → SEO**:

- **The site on search engines**: page title pattern (for example `%s · Smith Studio`, where `%s` is the page title), default sharing image, X account.
- **Search engines and AI**: ready for AI search, blocking crawlers that train AI models, RSS feed, paths not to be crawled, verification codes for Google Search Console and Bing Webmaster.
- **Redirects**: old address → new address.

Changes take effect from the next publish.

## Automatic redirects

If you change the address of a page that is already published, Materialize adds a permanent redirect (301) from the old address to the new one by itself. The same happens with pages imported from WordPress. You find them all in **Settings → SEO → Redirects**, where you can add or remove them.

## Sitemap

The sitemap is at `/sitemap.xml` and updates with every publish. Submit it once in Google Search Console. Opened in a browser, it reads as a list of pages with the date they last changed.

## AI search

More and more people search by asking ChatGPT, Claude, or Perplexity. With **Ready for AI search** turned on (it is by default), the site publishes:

- **`/llms.txt`**: the site's index for AI assistants, with the name, description, and contact details of the business, and the list of pages with their summaries.
- **A plain-text copy of every page**: add `.md` to the address (`/about-us.md`, `/index.md` for the home page). It contains only the content, without menu, footer, and forms, so an assistant reads and quotes it better.

Pages marked "don't index" are left out of both.

**Block crawlers that train AI models** stops GPTBot, ClaudeBot, Google-Extended, CCBot, and similar bots that read the site to train models. It doesn't block AI search (ChatGPT Search, Claude, Perplexity), which reads a page to answer someone and links to your site, the way Google does.

## RSS feed

The feed is at `/rss.xml`, with the latest 50 published items, their summary, and their image. It's useful for feed readers, newsletter services that send new articles automatically, and AI search. Every page announces it, so browsers and readers can find it.

By default it includes collections with a date, such as the Journal or news. In **Settings → SEO → RSS feed** you choose which collections to include. With no box checked, there is no feed.
