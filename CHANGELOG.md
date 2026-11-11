# What's new in Materialize

Every version, newest first. Upcoming changes go under «Next version»: `npm run bump` assigns them to the new version. [In Italian](CHANGELOG.it.md).

## Next version

- **Materialize with Docker Desktop, on your computer.** A step-by-step guide (Install → On your computer, with Docker Desktop): one command, the link from the log, and how to stop, update and remove it. The welcome page and the installation-link screen also give the command for Docker Desktop, `docker logs materialize`.
- **The changelog in English too.** What's new in each version is written in English (`CHANGELOG.md`) and Italian (`CHANGELOG.it.md`). Settings → Updates shows it in the language of each person's panel, and Settings → About links to the changelog and the guide in that language. The GitHub page now opens in English, with the Italian one a click away.

## 0.9.3 — 2026-11-11

- **The right address on articles.** The Address field shows the part that comes first, `/articoli/il-primo-articolo`, and no longer just `/il-primo-articolo`, which wasn't the real address.
- **Collection names in English.** Names of collections, blocks and fields can be written in several languages, `label: { it: 'Articoli', en: 'Articles' }`, and each person sees them in the language of their panel. The starter site has them in Italian and English; existing sites add them in `materialize.config.ts`.
- **Docker speaks Italian and gives the real address.** On startup, the server's messages show the domain's address for the site and the panel, and the internal one only as «Listening on». `compose.yaml` sets `MATERIALIZE_LANG=it` (changed in the `.env` file), and the container's startup messages follow the language too. No more Vite warning about large files on every publish: the only one is three.js, which loads only on pages with a 3D scene.
- In the Overview's latest changes, settings no longer repeat their name twice.
- **First steps on the Overview.** On a new site, administrators see what makes it a real site: site details, first published page, first article, AI connected, one person invited. Each step leads to where it's done and ticks itself off; the box goes away once all steps are done, or with its close button. While the site is still empty the Overview says so, instead of «The whole site is published». In The site at a glance, the Media card fills the row when there would be a gap.

- **The sitemap is readable in the browser too.** Opened by a person, `/sitemap.xml` shows a list of the pages with the date of their last change, in the site's language and in the light or dark theme. It uses a CSS stylesheet, not XSLT, which Chrome stops supporting on 17 November 2026. Nothing changes for Google.

## 0.9.2 — 2026-11-11

- **Settings → Site, redone.** A real page with a Save button: the site's name, description, logo and icon, its address; contacts, location, opening hours and social profiles. They were scattered between the settings document and the SEO page, with two different site names: now there is just one name. On the canvas, texts and buttons can show a **Site detail** (name, description, email, phone, address, opening hours), which updates on every page; a button with the email writes to it, one with the phone calls. The starter site's Email field, which did nothing, is gone. Sites with other fields in their settings find them in «Other site details».

- **Sitemap and RSS feed with Docker and on a VPS.** Sites that know their address only from `MATERIALIZE_SITE_URL` (Docker and the VPS installation) were built without `sitemap.xml` and `rss.xml`, and without full canonical links. Now the address reaches Astro by itself: just update.

- **New versions show up sooner.** The server checks every 6 hours instead of once a day, and opening Settings → Updates checks right away if the last answer is more than an hour old.

## 0.9.1 — 2026-11-11

- **Good to know if you update.** The default heading font is now Geist, the same as the body text and Materialize (it used to be Instrument Serif). It only changes on sites that never chose a heading font in Styles: if you want the old one, choose it there.

- **A blog on every new site.** The starter site (`npm create materialize` and Docker) has the **Articoli** (articles) collection: title, date, summary, cover and text, at the address `/articoli/…`. A page chosen as Template → Articoli gives every article the site's look; until there is one, they come out as a simple page in the theme's colors and fonts. Existing sites don't change: if you want it, copy the collection from the template's `materialize.config.ts`. The page the site shows before the home page looks like Materialize and says where to find the installation link; the panel screen that asks for it says so too, for Docker, VPS and your computer.

- **From the Docker installation trial.** In the editor, next to «Published», «Open in browser» opens the published page. In Media the Upload button stays in place when the details open, the preview is larger, and «View full size» shows the image full screen. The width selector in the editor has more room. In the Styles tab the theme's colors are one per row, with the full name and the code.
- **Handles on top and bottom.** Containers, images, videos and scenes can be resized in height too, from the top, the bottom or the corner; double-click and the height goes back to automatic. Texts and buttons follow their content.
- **Every Google Font in the list**: scrolling shows them all, not just the first 120. The menu opens where there is room.

## 0.9.0 — 2026-11-10

- **Good to know if you update.** `materialize dev` can only be reached from your computer (`--host 0.0.0.0` for your phone). Online, «Forgot password?» sends the link only if the site's address is configured (`site.url` or `MATERIALIZE_SITE_URL`). Form webhooks to internal addresses are refused (`MATERIALIZE_PRIVATE_WEBHOOKS=1` for a service on the same server). `getEntries` no longer returns template pages (`{ templates: true }` to get them). The panel starts in the browser's language until each person chooses one. When you change the server for AI, email or offsite backups, the saved key has to be entered again. The terminal speaks the system's language (`MATERIALIZE_LANG=it` for Italian).
- **The panel, from the general review.** You can publish from your phone: the button stays visible, an arrow takes you back to the list and pages open in Content mode; undo, redo, theme and history are in «More actions». «Published» no longer looks like a disabled button. Settings → Site no longer shows controls that don't belong there.
- **A consistent new look**: pill-shaped settings menu with the same width and title on every tab; media details, newsletter, people and fields on rounded cards; pill buttons, selectors and filters everywhere; lists aligned with their header.
- **Editor**: the property panel's selectors wrap onto two lines instead of overlapping their labels; the Add tab shows full names; in the Content panel, menu entries are called «Menu item»; the canvas's two «⋯» have different icons.
- **Newsletter**: sender settings in their own **Settings** tab; «Send now» says why it can't send; «Export» disabled with no subscribers; the names of the signup sections follow the panel's language.
- **Small things**: the new-messages badge also on **Settings** in the sidebar; the «Content language» label; the webhook key is hidden, with buttons to show and copy it; a fourth voice tone replaces the first; the activity log shows which document was «taken over»; a few failed sign-ins are no longer a warning; the rows' ⋯ menu shows on touch screens too; «Skip to content» in the panel too.
- **Accessibility and language**: the sign-in password field has its label; the property panel's controls have a name for screen readers; the language chosen on the sign-in page is no longer lost when you sign in; changing language reloads the server's texts; uploads and CSV exports follow the language of whoever makes them; form notifications to the owner go out in their language.
- **The site, from the general review.** An empty image or video no longer shows the editor's placeholder on the site. Template pages no longer end up in menus (`getEntries` leaves them out; their translations no longer have an address or a sitemap entry either). Links in the shared menu to a section that isn't on the page go to that section on the home page in the same language.
- **Site accessibility**: a «Skip to content» link when the page starts with a menu; the phone menu opens from the keyboard, moves focus to its items and closes with Esc; the button's labels are in the page's language; after scrolling to a section, the keyboard continues from there; decorative WebGL scenes are not announced; forms suggest name, email and phone.
- **Performance**: images tell the browser how much space they take (no more 1920 px version for a small card) and the first one on the page loads right away; WebGL scenes start only when they are near the screen and visible, so on a phone a hidden 3D model isn't downloaded.
- **SEO**: new sites created with `create-materialize` use the `Seo` component (descriptions, social previews, structured data, languages) and a `<main>` that leaves out menu and footer; a page without a description uses its first paragraph; breadcrumbs start from the home page and no longer point to pages that don't exist; articles are of type «article» without having to choose it; `og:locale` in the `it_IT` form.
- **Site security**: every page, error and redirect has the security headers (nosniff, referrer, no framing by other sites, HSTS over HTTPS); library images can be used in social previews and feed readers; a malformed address gets a 400 instead of a server error. In development, live reload also works from `127.0.0.1` and the local network, and the project's configuration files can't be read from the browser.
- **Security, from the general review.** Saved pages are cleaned before they become HTML: an element type, a CSS value, an SVG icon or a copy of a component can no longer bring code into the site (an editor could do it before, and the script would also have run for administrators who opened the page). Custom SVG icons are rebuilt from scratch with drawing elements only.
- Copies of components change only their own content; restoring a version follows the same rules as saving; only an administrator can change a form's automatic reply, as with recipients and webhooks.
- Internal addresses are blocked in their IPv6 forms and after a DNS change too, both in imports from a URL and in form webhooks (`MATERIALIZE_PRIVATE_WEBHOOKS=1` for a service on the same server).
- Size limits on requests to the server and on passwords; more limits on form messages per address; attachments of spam messages are not saved.
- «Forgot password?» online uses only the site's configured address (without one, the link isn't sent and Settings → Security says so) and always answers in the same time; resetting with the link closes sessions and revokes personal tokens.
- The public content API no longer shows forms' recipients, webhooks and automatic replies. The session cookie is `Secure` behind an HTTPS proxy too. Newsletter test sends are limited. When you change the server for AI, email or offsite backups, the saved key has to be entered again.
- **Update notice**: when a new version of Materialize comes out, administrators see a pill with the version number at the top right (on hover, the first changes) and an **Update** card on the Overview, both leading to Settings → Updates. The pill can be closed and comes back with the next version. It shows in development too, where you update from the terminal.
- **Smooth scrolling to sections**: links to a section of the same page, like menu items, no longer jump abruptly: the page scrolls smoothly (one second at most) and the section stops below the fixed menu, even if images higher up finish loading meanwhile. The wheel or a touch stops the scrolling; people who asked for reduced motion get the usual jump.
- **Materialize in English, complete.** Besides the panel, these are in English: the server's messages, emails to people with an account, the SEO, accessibility and performance checks, the names of the library's sections and styles, the terminal (`materialize` and `create-materialize`), the guide (`docs/guide`) and the README (`README.en.md`).
- Each person chooses their own language, in their profile or on the sign-in page; until they do, the panel follows the browser's language. Two people can use the same site, one in Italian and one in English: the server answers each in their language, and emails go out in the language of the recipient's profile.
- The terminal speaks the system's language; `MATERIALIZE_LANG=it` or `en` chooses it by hand.
- The texts visitors see stay in the site's language: pages, forms, cookie banners, newsletters.
- Texts the server saves for later are also read in the language of whoever looks at them: spam reasons, errors of scheduled publications, releases and newsletters, and the same messages in the activity log. Those saved before this version stay as they are.
- **Panel in English, part three: the rest of the panel.** Documents, lists and releases, ⌘K search, fields and media library, newsletter, people and two-step verification, every setting, the initial installation (with the language selector) and the tours.
- **Panel in English, part two: the editor.** Canvas, layers, library, styles, checks, property panel, animations, interactions, assistant, comments, tours and shortcuts, export, and the Design mode of block collections. New elements get their name and placeholder text in the panel's language.
- **`materialize dev` stays on your computer**: before, it could be reached from the whole network, and on a shared Wi-Fi someone else could have opened a new site and created its administrator. To try it from your phone: `--host 0.0.0.0`. `materialize start` doesn't change.
- **New look for the panel**: the menu, the work area and the editor's panels are rounded surfaces on a darker background; buttons, filters and selectors are pill-shaped.
- Search, theme and profile have moved to the top right, in a notch of the work area (on phones, in the top bar). The content language stays at the bottom left.
- In the editor, the controls above the canvas sit in three notches of its edge, and the zoom is a pill at the bottom right of the canvas. On narrow canvases the less used controls move into a ⋯ menu, so the bar isn't cut off.

## 0.8.0 — 2026-11-07

- **One document at a time**: if someone else is editing the page you open, you see it read-only, with who is working on it and for how long, and you can take over. Nobody overwrites someone else's work without knowing, not even from two tabs.
- **Sections with effects**: a new **Effects** category in the library, with 7 ready-made sections that use WebGL scenes and 3D: aurora opener, silk opener, 3D logo (upload your SVG), 3D object (choose a `.glb` model), numbers on the globe, animated image and particle call to action. You can also find them by searching «webgl».
- A new **Dark** color scheme for sections: it stays dark with light text in any theme.
- **Darken** now works on sections' animated backgrounds too, not just on photos.

## 0.7.0 — 2026-11-06

- **Panel tour**: the first time you sign in, a tour shows the panel one area at a time, like the editor's. You can take it again from the profile menu (**Panel tour**) or by searching «tour» with ⌘K.
- **Newsletter**: collect subscribers from the site with double opt-in by email, import them from Mailchimp or Brevo, write the newsletter from scratch, from an article or with AI from the latest articles, test it on yourself and send it right away or at a set time. Every email has the unsubscribe link; for every send you see opens and clicks. A new **Newsletter** item in the sidebar.
- The library's «Call to action → Newsletter» and «Footer → With signup» sections have a real form, connected to the newsletter.
- **Panel in English, part one**: anyone can choose English in their profile (or on the sign-in page); for now sign-in, sidebar, overview and profile are translated. Until the translation is complete, the panel starts in Italian for everyone.

## 0.6.0 — 2026-11-06

- **A renewed Overview**: it opens on what needs doing (documents to publish, the release in preparation, the next scheduled release, new messages), with a one-sentence summary, the latest changes and the site at a glance.
- **What shall we do on the site today?**: at the top of the overview, ask the AI for something about the whole site, like the missing Google descriptions or translating pages. It works in drafts only, without publishing or touching the theme and shared sections, and lists the drafts to review.
- **A bar above the selected element** in the editor: AI on the text, change image, duplicate, move up and down, how it looks on mobile, more actions and delete, without going to the right-hand panel.
- **WordPress import with AI layout**: an extra option redoes the layout of each imported page with the library's sections (opener, columns, lists, calls to action), with the same texts and images, in the draft. A check compares words and images before and after: if they would change, the page stays as it was.
- The WordPress import keeps the descriptions (alt text) of the images in the content: they used to get lost.
- **Editor tour, redone**: 14 steps instead of 4, each lighting up the real area it talks about (the tabs on the left open by themselves): Content and Design, Layers, Add, Styles, Checks, the canvas, properties, devices, zoom and preview, the AI assistant, history and publishing. Arrows to move, Esc to leave, and you can take it again from **?** → **Retake the tour**.
- **Releases**: gather several pages and articles that must come out together, for a launch or a campaign, and publish them with one click or at a set time. At the same moment, old pages can be taken off the site. All or nothing: if a page isn't ready nothing goes out, and the panel says which one and why. From the new **Releases** item in the sidebar, or from More actions → Add to a release.
- In dialogs, the cursor goes straight to the field to fill in.
- The icons of some buttons (Review with AI, Derive it from the site's texts, Copy, Apply, Create and copy the link) had the wrong size and filled the button.
- **The site from a brief**: from the Overview, **Site from a brief**. Describe the business in a few lines, with a reference image if you like, and the AI prepares the pages with the library's sections, with menu, footer, texts and Google descriptions. Everything stays in draft; existing pages, shared menus and the live site aren't touched. Colors, fonts and brand voice arrive as a proposal to apply with one click. Where information is missing (prices, address, phone) it leaves a placeholder in square brackets instead of making things up, and you can reply to the AI to ask for more.
- The assistant's answers show bold text and lists instead of asterisks and dashes.
- **AI review before publishing**: in the Checks tab (and in More actions for articles), **Review with AI** rereads the page and flags typos, grammar, sentences off the brand voice, inconsistencies and links that don't go where they say. Each finding has its fix, to apply with one click and undo with ⌘Z.
- **Brand voice for the AI**: in Settings → Brand voice, write who you are, the tone, how you address readers, words to use and avoid, and a sample text. The AI follows it in every text it writes: the ✨ button, the assistant, translations and MCP clients. The **Derive it from the site's texts** button proposes one by reading the published pages.

## 0.5.0 — 2026-11-05

- **New logo**: an M made of blocks that go from transparent to solid, because content takes shape. The name is set in Geist. You'll find it in the panel, the favicon, the sign-in page and the README; the files are in `docs/assets`.
- **Scheduled publishing**: choose when a page or article comes out, and if you like when it goes back to draft by itself (offers, events). From the calendar button next to «Publish», with shortcuts like «Tomorrow at 9». The draft goes out as it is at that moment; missing fields are flagged right away, and if something is wrong when it's time to go out, the page stays a draft and the panel says why. Dates show in the lists too.
- **Shareable preview links**: a secret link to show a draft to a client or a colleague without an account, with the site's real design. It expires after 1, 7 or 30 days or when you revoke it, follows the changes, doesn't end up on Google and shows a «Preview» label. From «More actions» → «Share preview».
- **Ready for AI search**: the site publishes `llms.txt`, the index for ChatGPT, Claude, Perplexity and the other assistants, and a Markdown copy of every page (for example `/chi-siamo.md`), easier to read and cite. It can be turned off in Settings → SEO.
- **RSS feed** at `/rss.xml` with the latest articles, announced on every page; collections are chosen in Settings → SEO.
- **More precise blocking of AI crawlers**: it blocks only those that train models; AI search (ChatGPT Search, Claude, Perplexity) stays free, because it brings visitors. PerplexityBot used to be blocked.
- **Accessibility and performance checks**: the editor's SEO tab becomes **Checks**, with three groups. Accessibility: text contrast measured on the real page (WCAG), images without a description, buttons and icons without a name, fields without a label, unclear links, skipped headings, videos without pause. Performance: files from other sites, heavy GIFs and videos, videos without a poster, too many 3D scenes, external scripts, too many fonts. Before publishing, serious problems are listed.
- **Sturdier forms**: antispam without CAPTCHA (spam goes into a recoverable folder), field checks on the server too, with the reason next to the field, private **file attachments**, recipients per form, an **automatic reply** to the sender, a signed **webhook** for Zapier, Make and n8n. In Settings → Messages: filters by form, unread and spam, search, **CSV export** and automatic deletion of old messages. The checkbox can open the privacy policy.
- A page brought back to how it is on the site (for example with ⌘Z) no longer shows as «Changes to publish».

## 0.4.0 — 2026-11-03

- **Reference images in the assistant**: attach, paste (⌘V) or drop into the chat a screenshot of a site you like, a mockup or a sketch, and the assistant takes its layout and mood with your site's sections and style. Up to 4 images per message; they don't go into the library and don't end up on the page.
- **Sturdier conversations with the assistant**: a second message after changing the selection on the canvas no longer fails, and each new message rereads the whole previous conversation from the cache, so it costs a fraction.
- **The assistant costs less**: with Claude it uses prompt caching, so instructions, tools and page, sent again at every step, cost a fraction of the price after the first.
- **Cheaper quick actions**: ✨ on texts, SEO and alt text use Claude Haiku 5.5, much cheaper than Opus; the assistant and page translations stay on the main model. Another model can be chosen in Settings → AI and MCP.
- **This month's AI usage** in Settings → AI and MCP: requests, tokens read (and how many from the cache) and written, to keep an eye on spending.
- **AI on formatted text**: the ✨ button is in the body of articles too, and rewrites, shortens or translates keeping headings, lists, bold, links and images.
- **✨ on the canvas keeps a text's bold, italics and links**, in the Inspector and in Content mode.
- **More reliable Shorten and Lengthen**: they ask for a precise length (about a third less, about half more), so a short text doesn't come back almost the same and one to lengthen doesn't become seven times longer.
- **The AI respects field lengths**: a rewritten text no longer goes over the field's maximum (before, for example, a 220-character summary could reach 234 and block publishing).
- **Describe with AI keeps credits**: the new alt text keeps the photo credit already written, like «photo by … on Unsplash», and its language.
- **Marquees with faded edges**: letters that go below the line (g, p, y) are no longer cut off at the bottom.
- **Panel addresses typed by hand**: `/admin/media`, `/admin/persone` and `/admin/impostazioni` lead to the right section, if no collection has that name.

## 0.3.0 — 2026-11-01

- **Offsite backups**, every night and encrypted, to S3-compatible storage (Cloudflare R2, Backblaze B2, Hetzner, Amazon S3…) or to a WebDAV folder (Nextcloud, Synology and QNAP NAS…). Turned on in Settings → Backups; `materialize decrypt` makes downloaded files readable again.
- **Easier email setup**: you choose the provider (Brevo, Postmark, Mailgun, Amazon SES, Gmail…) and the server fills in by itself; if the test fails, the panel explains why (blocked port, password refused, unverified sender…); **Check the domain** verifies SPF, DKIM and DMARC.
- **A clearer panel**: Settings → Protection split into Security, Backups and Activity log; editor toolbar in groups, with the less used items in **⋯**; resizable left panel in the editor; dropdowns, headers and help texts consistent and more readable; a dedicated page for panel addresses that don't exist; in People, who signs in with only a password is recognizable at a glance; sign-in and installation with the panel's look.
- **Who made each version**: the history shows the author's name next to the date.
- **About Materialize** in Settings: version, author, license, what's new, guide and third-party licenses.

## 0.2.0 — 2026-11-01

- **Forgot password?** on the sign-in page: a link by email, valid for one hour. Without email configured, the `materialize reset-password` command prints the link on the server, even for the only administrator.
- **History for canvas pages**: every version can be viewed on desktop, tablet and mobile before restoring it.
- **Export the page as PDF or PNG** from the editor, to send to the client: desktop, tablet and mobile, each as one long image.
- **A guide for people who use Materialize**, in `docs/guida`: installation, editor, content, languages, SEO, people, updates, backups and common problems.
- **Security**: invitation and new-password links always point to the site's public address, never to the one stated by whoever makes the request. Updating is recommended.

## 0.1.0 — 2026-10-31

The first public version.

- **Visual editor**: pages drawn on a canvas, with sections, columns, texts, images, videos, icons and shapes; reusable components with variants; rulers, guides, alignment and measurements; Content mode for people who only edit texts.
- **Animations and effects**: scroll and timeline animations, hover states, WebGL backgrounds and 3D objects.
- **Content**: collections like Projects, Journal and Team, with template pages; quick actions and multiple selection in lists and Media.
- **Multilingual sites**: translations linked to each other, with AI too, and a language switcher for the site.
- **SEO**: titles and descriptions, sitemap, on-page checks and automatic redirects when an address changes.
- **Contact forms** with emails sent from your mail server.
- **AI assistant and MCP server**: texts, translations and page changes by asking in words.
- **WordPress import**: pages, articles and images.
- **Analytics and cookies**: Google Analytics, Tag Manager, Meta Pixel, Plausible, Matomo and custom code, with the consent banner.
- **VPS installation with one command**: Node.js, HTTPS with Caddy, a service that restarts by itself, firewall and a link to finish in the browser.
- **Docker image** with a `compose.yaml` ready for HTTPS: the site lives in a volume, so updates from the panel stay even when the container is recreated.
- **Installation in the browser**: server check, the site's name and language, administrator account, step by step.
- **One-click updates** from Settings → Updates, with a backup first and automatic rollback to the previous version if the new one doesn't start; fixes can install themselves.
- **Security**: two-step verification, a pause after failed sign-in attempts, activity log, daily backups of the database and media.
