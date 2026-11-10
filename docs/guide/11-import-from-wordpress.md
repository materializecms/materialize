# Import from WordPress

In **Settings → Import**, you bring a WordPress site's posts, pages, images, categories and SEO data into Materialize. It works with Gutenberg, Elementor, WPBakery, Divi and the other editors.

## Two ways

- **From the site's address**: type the address, for example `https://www.example.com`, and click **Read the site**. Without a password, it imports published content. With an **application password** (WordPress → Users → Profile → Application Passwords), it imports drafts too.
- **From the export file**: in WordPress, go to **Tools → Export → All content**, then upload the `.xml` file. This is useful if the site can't be reached.

## Choosing what to import

Once it has read the site, the panel shows what it found and suggests where to put it: posts in one collection, pages in another. For each type, choose which fields to bring over (title, text, address, featured image, SEO title and description) and whether to:

- **Publish**: publish complete entries right away, or leave them as drafts;
- **Redirect**: add redirects from the old WordPress addresses to the new ones.

## What happens

1. **Images** are downloaded into the Media library at their original size, once only even if they're used several times.
2. **Content** is created, with rich text and images in place.
3. **Internal links** point to the new pages.
4. **Old addresses** redirect to the new ones with a 301, so you don't lose Google rankings or links from other sites.

Addresses that already exist in Materialize are not overwritten.

## What's left to do

Pages arrive with their **content in order**, one section for each main heading, but with a simple layout. You redo the design on the canvas with the editor, starting from the library's sections.

### Layout with AI

If AI is set up (Settings → AI and MCP), you can turn on **Redo the pages' layout with AI** before importing. After the import, the AI rebuilds each page with sections from the library: an opening with a heading and image, services in columns, lists as cards or checkmarks, calls to action.

- **Same text, same images**: the AI doesn't rewrite or add anything, it only moves the content into sections. A check compares the words and images before and after. If any are missing or new ones appear, the page keeps the simple layout and the report says why. Image descriptions are kept.
- **In the draft**: if you chose to publish, the simple version goes live. The AI's version is in the draft, marked "Changes to publish", for you to review and publish once you're happy with it.
- One page at a time, with the main model: a site with a few pages takes a few minutes. You can see the usage in Settings → AI and MCP.

SVG images are not imported, for security. The panel tells you so and explains why.
