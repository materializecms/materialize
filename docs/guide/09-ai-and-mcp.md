# AI assistant and MCP

AI in Materialize is optional: everything works without it. When it's set up, it helps you write, translate and edit pages.

## Setting it up

In **Settings → AI and MCP**, under **AI model**, an administrator picks the **Provider**:

- **Claude (Anthropic)**: you need an **API key**, from [console.anthropic.com](https://console.anthropic.com) → API Keys. The default model is Claude Opus 5.5.
- If you leave it empty, the **Model for quick actions** (✨, SEO, alt text) is **Claude Haiku 5.5**. It's great for short texts and costs much less. The editor's assistant and page translations use the main model. **Save and test** checks both.
- **OpenAI compatible**: OpenAI itself or a compatible server, even one on your own computer such as Ollama. You enter the server address and the model name.

The key stays on the server: once saved, the panel never shows it again. You can also set the `ANTHROPIC_API_KEY` environment variable on the server (on a VPS installed with the script, it goes in `/etc/materialize/env`, then run `systemctl restart materialize`).

You pay the provider for AI based on how much you use it. Below the form, **Usage this month** counts the requests and the tokens read and written. The exact cost is on the provider's site (for Claude, console.anthropic.com → Usage). The most expensive part is the editor's assistant, which rereads the page at every step. With Claude, that rereading goes through the prompt cache and costs much less.

## What it does

- **Text**: from the ✨ button next to a text (in the editor, in Content mode and in fields, including the rich text of posts): **Rewrite better**, **Shorten**, **Lengthen**, **Fix mistakes**, **More formal**, **More casual**, or a request in your own words. In rich text, headings, lists, bold, links and images stay. On the canvas, bold, italics and links in the text stay. **Shorten** cuts about a third, **Lengthen** adds about half. If the field has a maximum length, the result respects it.
- **SEO**: suggests the page's title and description.
- **Alt text**: describes an image by looking at it. If there was already a credit, such as "photo by … on Unsplash", it keeps it at the end.
- **Review before publishing**: rereads the page and flags typos, grammar, sentences that don't match the brand voice, inconsistencies and links that don't go where they say, each with a fix you apply in one click (see [Page checks](03-editor.md#page-checks)).
- **Requests from the overview**: in plain words, across the whole site, as drafts (see [below](#requests-from-the-overview)).
- **Site from a brief**: from the **Overview**, a first draft of the site from a few lines about the business (see [below](#site-from-a-brief)).
- **Translations**: creates a page in another language (see [Sites in several languages](05-languages.md)).
- **Assistant in the editor**: from the icon at the top of the editor, ask in plain words, for example "add a section with three services" or "make the headings bigger". The changes land on the page as a draft, and a single **⌘Z** undoes them all.
- **Reference images**: with the 🖼 button next to the field, by pasting (⌘V) or by dragging a file into the chat, you attach up to 4 images, for example a screenshot of a site you like, a mockup or a photo of a sketch. The assistant borrows their layout, hierarchy and mood, but uses your site's sections, colors and text. It doesn't copy logos or text, and it doesn't put the image on the page. Images are scaled down before sending, so they cost little.

## Requests from the overview

At the top of the **Overview** is the field **What shall we do on the site today?**. Use it to ask in plain words for something that concerns the whole site, not just one page: "write the Google description for pages that don't have one", "check the texts in the Journal", "prepare an FAQ page", "translate the main pages into English". Below it are a few ready-made ideas, and you can attach up to 4 images.

- The AI looks at the site, then changes or creates content. **Everything stays a draft**: it can't publish, schedule, share previews, change the theme, or touch menus, shared footers and components, which go live on every page at once. If your request involves them, it does the rest and tells you what to fix in the panel.
- Under the answer you see the **Drafts to review**: one click opens each in the editor, where History can take back any change.
- You can reply and ask for more in the same conversation. **New request** starts over and **Stop** halts it.
- It follows the [brand voice](#brand-voice). Someone who can only change content can only ask for that.

## Site from a brief

To start from scratch, an administrator finds **Site from a brief** in the **Overview**. Write a few lines on what the business does, for whom, where, and what the site should achieve. If you like, add up to two images of a site or a design you like: the AI takes mood and colors from them, never text or logos.

The AI plans a small site, usually the home page and two to four pages, and builds them one at a time with sections from the library: the same navigation at the top and a footer with links between the pages, text written for the business, and a title and description for Google. In the window you see what it's doing and the drafts as they appear. Click a draft to open it in the editor.

- **Everything stays a draft**: existing pages, shared menus and footers, and the live site aren't touched. If an address is already taken, for example the home page, the AI picks another or asks you.
- **No made-up facts**: where information is missing (prices, address, phone, names), the AI leaves a placeholder in square brackets, like "[Phone number]", so you know what to fill in. Images stay the library's sample ones, with a description of the photo to use, if the media library has no suitable one.
- **Colors and fonts** are a suggestion: at the end you see the palette and the fonts, and **Apply the theme** puts them on the whole site, live too. You can turn this off before you start.
- **Brand voice**: if there isn't one yet, the AI suggests one from the brief, and **Save the voice** keeps it. If there is one, it writes following it.
- **Answer the AI**: if it's unsure, it stops and asks. At the end you can also ask for more, like "add an About us page". **Stop** halts it, and the drafts already made stay.

It uses the main model and takes a few minutes. A test with two pages took 13 steps, almost all reread from the prompt cache, which costs a fraction. You can see what you spent in **Usage this month** and on the provider's site.

## Brand voice

In **Settings → Brand voice**, describe how the site speaks, so the AI writes like you and not like everyone else:

- **Who we are and who we write for**: one or two sentences on what you do, for whom, and what sets you apart.
- **Tone**: up to three from Professional, Friendly, Direct, Inspirational, Technical, Elegant, Reassuring, Witty. Picking a fourth replaces the first one you chose.
- **How you address the reader**: informal you (tu), plural you (voi) or formal you (Lei).
- **Words to use** and **Words to avoid**, separated by commas.
- **Other rules**, for example "Short sentences. No exclamation marks."
- **A text that sounds like you**: a paragraph of your own. The AI takes its style, never its content.

Not sure where to start? **Work it out from the site's texts** reads the pages already published and fills in the form. Check it, fix it and save. Nothing changes until you save.

The AI uses the voice in two ways:

- **When it writes from scratch**, that is the title and description for Google, a request in your own words from the ✨ button, the editor's assistant and clients connected through MCP, it uses the whole voice, including who you are and the words you prefer, as material to write with.
- **When it changes text you wrote**, that is Rewrite, Shorten, Lengthen, More formal, More casual and translations, it uses only the style: tone, how you address the reader, words to avoid, rules and sample text. The content stays yours: the AI doesn't add facts, services or promises that weren't in the text.

It doesn't use the voice for **Fix mistakes** or for image alt text, which just describe. A conversation already open with the assistant keeps the voice it started with. The new one applies from the next conversation.

An administrator changes the voice; everyone can see it.

## MCP: connecting an external AI client

MCP is a standard way for an AI application (Claude Desktop, Claude Code, other clients) to work on your site: read and edit pages, collections and media, just as a person would from the panel.

1. In **Settings → AI and MCP → Access tokens**, create a token. The AI will act **with your permissions**: if you're an editor, it can't do administrator things.
2. Copy the token: it's shown only once.
3. Follow the instructions on the same page, already filled in with your site's address:
   - **over HTTP**: the address is `https://example.com/mcp`, with the token;
   - **Claude Code**: a command to copy;
   - **Claude Desktop and local clients**: the lines to put in the client's configuration file.

You can **revoke** a token at any time from the same page. **Settings → Protection → Security** lists tokens that haven't been used in a while.
