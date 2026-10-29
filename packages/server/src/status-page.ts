import type { MaterializeConfig } from '@materialize/core'
import { html } from 'hono/html'

/** Page served at "/" until the site renderer ships: confirms the server works and links to the admin. */
export function statusPage(config: MaterializeConfig, version: string, needsSetup: boolean) {
  const rows = config.collections.map((c) => html`<li><span>${c.label}</span><code>/api/content/${c.name}</code></li>`)
  return html`<!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${config.site.name} · Materialize</title>
        <style>
          :root { color-scheme: light dark; --bg: #fafafa; --fg: #0a0a0b; --muted: #5e5e66; --line: #e6e6ea; --accent: #3d5afe; }
          @media (prefers-color-scheme: dark) { :root { --bg: #0b0b0c; --fg: #ededef; --muted: #a1a1aa; --line: #232327; --accent: #7c93ff; } }
          * { box-sizing: border-box; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; }
          main { width: 100%; max-width: 560px; }
          .mark { width: 36px; height: 36px; border-radius: 9px; background: var(--accent); display: grid; place-items: center; color: #fff; font-weight: 700; }
          h1 { font-size: 22px; margin: 20px 0 4px; letter-spacing: -0.01em; }
          p { margin: 0 0 16px; color: var(--muted); }
          ul { list-style: none; padding: 0; margin: 20px 0; border-top: 1px solid var(--line); }
          li { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
          code { font: 13px ui-monospace, 'SF Mono', monospace; color: var(--muted); }
          .note { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); font-size: 14px; }
          .button { display: inline-flex; align-items: center; height: 40px; padding: 0 18px; border-radius: 10px; background: var(--fg); color: var(--bg); font-weight: 600; text-decoration: none; }
        </style>
      </head>
      <body>
        <main>
          <div class="mark" aria-hidden="true">M</div>
          <h1>${config.site.name} è online</h1>
          <p>Materialize ${version} · ${config.collections.length} collezioni · lingue: ${config.locales.available.join(', ')}</p>
          <ul>
            ${rows}
          </ul>
          <a class="button" href="/admin/">${needsSetup ? 'Configura il pannello' : 'Apri il pannello'}</a>
        </main>
      </body>
    </html>`
}
