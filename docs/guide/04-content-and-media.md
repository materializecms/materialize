# Content and media

## Collections

The items in the **Content** menu are the site's **collections**. Every new site has two: **Pages** and **Articoli** (the blog). Depending on the site there can be others, such as Projects or Team. Each item in a collection has its own fields: title, text, images, dates, links to other items.

Collections and fields beyond Pages and Articoli are added by whoever develops the site, in `materialize.config.ts` (see the [README](../../README.md#lo-schema-è-codice)). People who write content find them ready in the panel.

## Articles

An article has a title, date, summary, cover and text, and is published at `/articoli/…`. Until you design how it looks, each article comes out as a plain, readable page in the site's colors and fonts.

To give it the menu, the footer and your style:

1. create a page, for example "Article", and design it on the canvas; text and images linked to the fields (title, date, cover…) fill in with the real article;
2. in the right panel, under **Template**, choose **Articoli**: from then on every article uses this page.

For the list of articles, on a page such as "Blog", use a container that repeats for every article (see [Lists and template pages](03-editor.md#lists-and-template-pages)). Articles also go into the site's RSS feed.

In the lists:

- **Search** and the **Status** filter help you find items;
- select several items to publish, unpublish, duplicate, or delete them together;
- an item's **⋯** menu offers the same actions one at a time, plus copying the address.

## Drafts and publishing

- While you write, everything saves by itself as a **draft**, even a half-finished page.
- **Publish** puts the draft on the site. If required fields are missing, the panel tells you and takes you to the field.
- **Unpublish** turns a published page back into a draft: it disappears from the site but stays in the panel.
- If you change the address of a page that is already published, the old address **redirects** to the new one by itself, so external links and Google don't run into errors.

## Scheduled publishing

To release a page or an article later, use the **calendar** button next to **Publish**:

- In **Publish on**, choose the day and time, or a shortcut such as **Tomorrow at 9**, and press **Schedule**. The date appears in the header, for example "Goes out Mon Nov 10, 09:00". The same date shows in the lists.
- You can keep editing the draft. At the right time, the version that goes out is the one as it is at that moment.
- In **Unpublish on**, choose when the page goes back to draft by itself, for an offer or an event that ends.
- To change the date, open the calendar again. **Cancel** removes the schedule. If you publish by hand first, the schedule is no longer needed and cancels itself.
- Required fields are checked right away. If the page is no longer complete when it's due to go out (you emptied a field in the meantime), it stays a draft and the button turns red: **Schedule failed**, with the reason. Fix it and schedule again, or publish.
- If the server is off at the chosen time, the page goes out as soon as the server is back.

The **Activity log** (Settings → Activity log) shows every scheduled publication, under the name of the person who scheduled it.

## Releases: several pages that go out together

A launch, a new collection, or a campaign often needs several pages online at the same moment, and maybe an old one taken down. A **release** groups them:

- From a page: **More actions → Add to a release**. Choose a release or create a new one, and choose what happens to the page: **Publish this draft** or **Unpublish**. The release name, or the release date, appears in the header.
- From the sidebar, **Releases** shows the releases in progress. With **Add** you search for pages and articles, the menu on each row changes the action, and the cross removes the page from the release. Click the name to change it.
- **Publish all now** releases everything right away. **Schedule** picks a day and time, just as for a single page: the drafts go out as they are at that moment, under the name of the person who scheduled it.
- **All or nothing**: if one page isn't ready (an empty required field, for example), nothing goes out. Pages with a problem are flagged in red, and a scheduled release that fails stays there with the reason: fix it and schedule again.
- A page belongs to only one release at a time: adding it to another moves it. Until it goes out it stays as it is, and you can keep editing it.
- The trash can cancels the release: the pages stay as they are, and only the group is dissolved. Releases that have gone out stay at the bottom of the screen, under **Already out**.

AI can use releases too, with the MCP tools `list_releases`, `create_release`, `add_to_release`, `publish_release`, and `schedule_release`.

## Preview links

To show a draft to someone who doesn't sign in to the panel, such as a client or a colleague, open **More actions** (the three dots at the top) → **Share preview**:

- Choose how long the link works: **1 day**, **7 days**, **30 days**, or **No expiry**. Then press **Create and copy the link** and send it however you like.
- Whoever opens it sees the page with the site's real design, even if it isn't published yet, with a small "Anteprima · non ancora pubblicata" (Preview · not yet published) label.
- The link follows your changes: it always shows the latest saved version. You don't need to create a new one after each fix.
- In **Active links** you see who created each link, when it expires, and how many times it was opened. The trash can **revokes** it: from then on it no longer opens.
- Search engines don't see these pages, and visits don't count in the analytics.

Anyone with the link can see the draft. Send it only to the people who need to see it, and revoke it when it's no longer needed.

## History

Every save creates a version, with the date and the name of the person who made it (**Removed person** if their account has since been deleted).

- **Collection items** (for example an article or a project, edited through fields): the **Document panel** button at the top shows the status, address, language, and **History**. **Restore** brings the item back to how it was. The restore is a draft too: it reaches the site only when you publish.
- **Pages built on the canvas**: the **History** button at the top opens the list of versions. Click one to **view it on desktop, tablet, and mobile**, without touching the draft. **Restore this version** brings it back into the draft (and **⌘Z** undoes the restore). **Close** returns to the page as it was. The restore reaches the site only when you publish.

Versions use today's menu, footer, and components: those are shared by all pages and have their own history.

## Formatted text

Long text fields have headings, bold, italics, lists, links, quotes, and images inside the text. You write as you would in a normal word processor.

## Media

**Media** holds all uploaded files.

- **Uploading**: drag files onto the page, or use the button. You can also upload straight from an image field.
- **Viewing large**: click a file to see its details beside the list; click the preview to see the image full screen (Esc to close).
- **Alt text**: for each image, describe what it shows. It helps people who can't see the image, and search engines. The AI assistant can suggest it (see [AI assistant](09-ai-and-mcp.md)).
- **Focal point**: in images that support it, click the most important spot. When the image is cropped, that spot stays in the center.
- **Used in**: each image shows how many pages use it, so you know what you affect before deleting it.

Uploaded images lose their camera data (GPS location included) and are straightened. The site serves them by itself in modern formats (AVIF, WebP) and at the right size for each device, so you can upload the original photo without worrying about file size.

3D models (`.glb`) uploaded to Media are used in the editor's WebGL scenes.
