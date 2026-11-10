# The page editor

The editor shows the real page, exactly as it will look on the site, and you edit it right there. Open it with **Design** at the top of the page.

## How it's laid out

- **On the left**, four tabs:
  - **Layers**: a list of everything on the page, nested one inside another;
  - **Add**: ready-made sections and elements to put on the page;
  - **Styles**: colors, fonts, and settings for the whole site;
  - **Checks**: search engines, accessibility, and performance for the page (see [Page checks](#page-checks)).

  You can widen the panel by dragging its right edge, up to 440 px, and the browser remembers it. Double-click the edge to bring it back to its original width.
- **In the center**, the **canvas**: the page.
- **On the right**, the panel for the selected element. It changes with the element (layout, size, colors, text, animations…). With nothing selected, it shows **Page**: title, address, template, and search engines.
- **At the top of the canvas**, three groups of commands, each in its own notch of the border:
  - on the left, **Add**: container, text, image, button, icon, or shape. **⋯** opens the others (video, code, WebGL scene, form field);
  - in the center, the device (desktop, tablet, mobile), the width, all side by side, and **Export**;
  - on the right, **?** for shortcuts, the rulers, the AI assistant, comments, the animation preview, and **Preview**, to try the page as it works on the site.
- **At the bottom right of the canvas**, zoom: zoom out, zoom in, fit to window.
- When the canvas is narrow (a small window or widened panels), side-by-side devices, export, rulers, animation preview, and shortcuts move into the **⋯** menu of the right-hand group. Button and icon stay in the **Add** tab and on the B and O keys.

The first time, a **tour** introduces the editor in 14 steps. It darkens the screen and highlights one area at a time: Content and Design, the four tabs on the left (which it opens by itself), the bar for adding elements, the canvas, the properties panel, devices, zoom and preview, the AI assistant, history, and publishing. Move through it with ← → or the buttons, and close it with Esc. To take it again: **?** (or the keyboard button at the top) → **Take the tour again**.

## Adding

From the **Add** tab:

- **Sections**: more than 100 ready-made sections in 25 categories (navigation, hero, about, services, projects, testimonials, team, FAQ, contact, effects, footer…). Drag them onto the canvas or add them with a click. They take on your site's colors and fonts.
- **Elements**: container, text, image, button, video, icon or shape, form field, WebGL scene, code, language switcher.

Every element also has a shortcut key: **F** container, **T** text, **I** image, **B** button, **V** video, **O** icon or shape, **K** form field, **G** WebGL scene, **C** code, **L** language switcher.

## Selecting and editing

- **Click** to select, **double-click** a text to type in it, **drag** to move.
- **⇧ click**, or a box dragged from an empty area, selects several elements. Style changes then apply to all of them.
- **Enter** goes into a container, **Esc** goes back to the container around it, **Tab** moves to the next element.
- **⌘D** duplicates, **⌫** deletes, **⌘G** groups into a container, **⇧⌘G** ungroups, **⌥↑ ⌥↓** move up and down.
- **⌘Z** undoes, **⇧⌘Z** redoes.
- **⌥⌘C** and **⌥⌘V** copy and paste the style from one element to another.
- Above the selected element, a **quick actions bar** appears: ✨ for AI on the text, change image, duplicate, move up or down, **How it looks on mobile** (switches to the mobile view and keeps the selection), more actions, and delete. It disappears while you type or drag.
- Right-click opens the element's menu, with **Lock** so you don't move it by mistake.

On Windows, use **Ctrl** instead of **⌘** and **Alt** instead of **⌥**.

## Layout and sizes

A container arranges its elements **in a row**, **in a column**, or **in a grid**, with spacing and alignment. An element can also sit in a **free position**, on top of the others.

- When you drag a free element, **snap guides** appear toward nearby edges and centers (hold **⌘** to move it without snapping).
- Hold **⌥** to see the distances to the element under the pointer.
- **⇧R** shows the rulers. Drag from a ruler to create a guide.
- **Align and distribute**: ⌥⌘A left, ⌥⌘D right, ⌥⌘W top, ⌥⌘S bottom, ⌥⌘H and ⌥⌘V center.

## Appearance

For every element: colors and gradients, typography, borders and corners, shadows, opacity, filters, glass effect, blending. You pick colors from the theme, so pages stay consistent no matter who edits them.

**Shared text styles**: create a style from a text (font, sizes for each device, color) and apply it to other texts. When you change the style, every text that uses it changes too.

## Tablet and mobile

Choose the width at the top. Any change made in tablet or mobile applies only to that device, and everything else follows desktop. **All devices side by side** shows the three versions together. You can change the widths at which the site switches from desktop to tablet and mobile in the **Styles** tab.

## Animations and interactions

In the panel on the right, for every element:

- **when it starts**: when the page opens, when the element comes into view, on scroll, on hover or mouse movement, on click;
- **what it does**: fades, moves, rotations, text that comes in word by word or letter by letter, counters, parallax, elements pinned while scrolling, scrolling ribbons;
- **timelines**: several keyframes, each with its own curve, to try out with the timeline slider;
- **on hover**: colors, scale, movement, and shadow, even when the pointer is over the card that contains the element.

**Play animations**, at the top, lets you try the page as it works on the site (Esc to exit). Visitors who asked their device to reduce motion see the site without movement.

## WebGL and 3D scenes

The **WebGL scene** element adds animated backgrounds, image effects, and 3D objects (shapes, logos, `.glb` models uploaded to Media) with materials such as chrome, glass, and gold. The 3D files only load on the pages that use them.

To start from something ready-made, **Add** has an **Effects** category (or search for "webgl"): an opening on an aurora background, an opening with animated silk, a 3D logo, a 3D object, numbers next to a spinning globe, an image that bends on hover, and a call to action on a sky of particles. In the 3D logo, upload your logo as SVG. In the 3D object, choose a `.glb` model from Media. In the animated image, choose the photo.

Two things help keep text readable on top of an animation:

- the **Dark** color scheme (panel on the right → Colors): the section stays dark with light text whatever the theme, like a section over a photo;
- **Dim**, which darkens a section's animated background just as it already does with photos.

## Components

An element, for example a card or a button, can become a reusable **component**, even with several **variants**. The design applies to every copy, while text, images, and links stay different in each copy. When you change the component, all copies change.

## Lists and template pages

- A container can **repeat for every item in a collection** (for example all projects), sorted and filtered, with a "Show more" button.
- A page can act as a **template** for every item in a collection: design the "project" page once and it works for all projects. The preview shows a real item.
- **Shared sections**, such as the menu and footer, apply to every page: you edit them only once.

## The Styles tab

This applies to the whole site:

- named **colors**, one for the light theme and one for the dark theme;
- **fonts**: any Google Font (about 2,000). Materialize downloads them once and serves them from your site, so visitors don't contact Google;
- corners, tablet and mobile widths, smooth scrolling, custom cursor, page transitions.

## Page checks

The **Checks** tab on the left (in Content mode it sits next to Sections) checks the page while you edit it, in three groups. Click a problem to select the element to fix.

- **Search engines**: title and description, a single main heading, links to pages that don't exist, amount of text, sharing image (see [SEO](06-seo.md)).
- **Accessibility**, for people who use a screen reader or a keyboard, or who have low vision:
  - **hard-to-read text** on its background, measured on the real page with the WCAG rule: at least 4.5:1, or 3:1 for large text. Text over a photo, a video, or a 3D scene can't be measured, so check it by eye;
  - images without a description, clickable buttons and icons without a name, form fields without a label;
  - unclear links and buttons, such as "click here" or "learn more";
  - skipped heading levels, and videos that play by themselves without controls to stop them.
- **Performance**, so the page opens quickly even on a phone: images or videos taken from other sites (they aren't optimized), heavy GIFs and videos, videos without a cover image, more than two 3D or WebGL scenes, external scripts in custom code, more than three different fonts, pages with a very large number of elements.

**AI review**: at the top of the tab, if AI is set up, **Review with AI** has the page read over as if by a proofreader. It flags typos, grammar mistakes, sentences that don't match the [brand voice](09-ai-and-mcp.md#brand-voice), information that contradicts itself (a price or a date that differs in two places), and links whose words promise something other than the page they lead to. For each issue it shows the exact words and the correction. **Apply** puts it into the draft, and ⌘Z undoes it. The cross dismisses it. Click the text to select the element on the canvas. The review only runs when you ask for it, because each reading is a request to the AI (a few cents). It stays there until you close the page. If you then edit the page, a notice tells you it has changed. For articles and other content without a canvas, you find it in **More actions → AI review**.

**Before publishing**, if the page has serious accessibility or performance problems, Materialize lists them and asks whether to publish anyway or see them. Suggestions never stop you from publishing.

## Exporting for the client

**Export as PDF or PNG**, at the top next to **All devices side by side**, creates a file of the page as it is right now, even if it isn't published yet. Use it to send the page to whoever needs to approve it.

- Choose the devices: desktop, tablet, mobile.
- **PDF**: a single file, one page per device. Each page is as long as the web page, with nothing cut off, and shows the page name, the device, and the date at the top.
- **PNG**: one image per device. The browser may ask for permission to download several files at once.

The file shows the page standing still: no animations, and WebGL scenes in their static version.

## Working as a team

- **Comments**: on an element or on the page, from the icon at the top.
- **Who's here**: see who else has the page open and what they have selected.
- **Undo and redo**: ⌘Z and ⇧⌘Z, or the buttons at the top right.
- **History**: every version of the page, to view on each device and restore (see [Content and media](04-content-and-media.md#history)).

## Custom code

The **Code** element inserts hand-written HTML. For security, only an administrator can add it.
