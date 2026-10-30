/**
 * Analytics, tags and pixels on the published site, and the consent they need (Impostazioni →
 * Tracciamento e cookie). Scripts of the "analytics" and "marketing" kinds are written inert and
 * start only once the visitor accepts them in the banner; "necessary" ones (and cookieless
 * analytics such as Plausible) run at once. Google tags also get Consent Mode v2 signals.
 */

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing'

export interface CustomCode {
  id: string
  /** For people: "Hotjar", "Chat di assistenza"… */
  name: string
  /** In <head>, or at the end of <body>. */
  place: 'head' | 'body'
  category: ConsentCategory
  code: string
}

export interface TrackingSettings {
  /** Google Analytics 4: "G-XXXXXXX". */
  ga4?: string
  /** Google Tag Manager: "GTM-XXXXXXX", and what its tags are for. */
  gtm?: string
  gtmCategory?: ConsentCategory
  /** Meta (Facebook) Pixel id. */
  metaPixel?: string
  /** Plausible: the site's domain as registered there, and the script address when self-hosted. */
  plausible?: string
  plausibleSrc?: string
  /** Matomo: the address of the Matomo installation and the site id. */
  matomoUrl?: string
  matomoSiteId?: string
  custom?: CustomCode[]
  banner?: {
    title?: string
    text?: string
    /** The cookie policy page. */
    policyUrl?: string
    position?: 'bottom' | 'corner'
    /** A small button that reopens the preferences, besides links to "#preferenze-cookie". */
    reopenButton?: boolean
  }
}

/** Ids as the services write them: anything else is refused, so nothing odd lands in the page. */
export const TRACKING_PATTERNS = {
  ga4: /^G-[A-Z0-9]{4,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,12}$/,
  metaPixel: /^\d{6,20}$/,
  plausible: /^[a-z0-9.-]+\.[a-z]{2,}$/,
  matomoSiteId: /^\d{1,6}$/,
}

const TEXTS = {
  it: {
    title: 'Rispettiamo la tua privacy',
    text: 'Usiamo cookie tecnici, necessari al sito, e, solo con il tuo consenso, cookie di statistica e di marketing. Puoi cambiare idea quando vuoi.',
    accept: 'Accetta tutti',
    reject: 'Rifiuta',
    customize: 'Personalizza',
    save: 'Salva le scelte',
    policy: 'Cookie policy',
    necessary: 'Necessari',
    necessaryHint: 'Fanno funzionare il sito: sempre attivi.',
    analytics: 'Statistiche',
    analyticsHint: 'Ci dicono, in forma aggregata, come viene usato il sito.',
    marketing: 'Marketing',
    marketingHint: 'Misurano le campagne e mostrano annunci pertinenti.',
    reopen: 'Preferenze cookie',
  },
  en: {
    title: 'We respect your privacy',
    text: 'We use technical cookies the site needs and, only with your consent, statistics and marketing cookies. You can change your mind at any time.',
    accept: 'Accept all',
    reject: 'Reject',
    customize: 'Customize',
    save: 'Save choices',
    policy: 'Cookie policy',
    necessary: 'Necessary',
    necessaryHint: 'They make the site work: always on.',
    analytics: 'Statistics',
    analyticsHint: 'They tell us, in aggregate, how the site is used.',
    marketing: 'Marketing',
    marketingHint: 'They measure campaigns and show relevant ads.',
    reopen: 'Cookie preferences',
  },
}

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/** JSON inside a <script>: "</script>" in a value must not end it. */
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

/** The built-in services as code blocks, with their consent kind. */
function services(t: TrackingSettings): CustomCode[] {
  const out: CustomCode[] = []
  if (t.ga4 && TRACKING_PATTERNS.ga4.test(t.ga4))
    out.push({
      id: 'ga4',
      name: 'Google Analytics',
      place: 'head',
      category: 'analytics',
      code: `<script async src="https://www.googletagmanager.com/gtag/js?id=${t.ga4}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${t.ga4}');</script>`,
    })
  if (t.gtm && TRACKING_PATTERNS.gtm.test(t.gtm))
    out.push({
      id: 'gtm',
      name: 'Google Tag Manager',
      place: 'head',
      category: t.gtmCategory ?? 'marketing',
      code: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t.gtm}');</script>`,
    })
  if (t.metaPixel && TRACKING_PATTERNS.metaPixel.test(t.metaPixel))
    out.push({
      id: 'meta',
      name: 'Meta Pixel',
      place: 'head',
      category: 'marketing',
      code: `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.metaPixel}');fbq('track','PageView');</script>`,
    })
  if (t.plausible && TRACKING_PATTERNS.plausible.test(t.plausible)) {
    const src =
      t.plausibleSrc && /^https:\/\/[^"<>\s]+$/.test(t.plausibleSrc)
        ? t.plausibleSrc
        : 'https://plausible.io/js/script.js'
    // No cookies, no personal data: it needs no consent.
    out.push({
      id: 'plausible',
      name: 'Plausible',
      place: 'head',
      category: 'necessary',
      code: `<script defer data-domain="${attr(t.plausible)}" src="${attr(src)}"></script>`,
    })
  }
  if (
    t.matomoUrl &&
    /^https:\/\/[^"'<>\s]+$/.test(t.matomoUrl) &&
    t.matomoSiteId &&
    TRACKING_PATTERNS.matomoSiteId.test(t.matomoSiteId)
  ) {
    const base = t.matomoUrl.replace(/\/*$/, '/')
    out.push({
      id: 'matomo',
      name: 'Matomo',
      place: 'head',
      category: 'analytics',
      code: `<script>var _paq=window._paq=window._paq||[];_paq.push(['trackPageView']);_paq.push(['enableLinkTracking']);(function(){var u=${json(base)};_paq.push(['setTrackerUrl',u+'matomo.php']);_paq.push(['setSiteId',${json(t.matomoSiteId)}]);var d=document,g=d.createElement('script'),s=d.getElementsByTagName('script')[0];g.async=true;g.src=u+'matomo.js';s.parentNode.insertBefore(g,s);})();</script>`,
    })
  }
  return out
}

/** Every block, built-in services first. */
export function trackingBlocks(t: TrackingSettings): CustomCode[] {
  return [...services(t), ...(t.custom ?? []).filter((c) => c.code.trim())]
}

/** True when the site needs to ask: some script waits for consent. */
export const needsConsent = (t: TrackingSettings) => trackingBlocks(t).some((b) => b.category !== 'necessary')

/**
 * What goes in the <head> of every published page. `lang` picks the banner's default words,
 * `accent` its buttons' color (the theme's).
 */
export function trackingHtml(
  t: TrackingSettings | null | undefined,
  options: { lang?: string; accent?: string } = {},
): string {
  if (!t) return ''
  const blocks = trackingBlocks(t)
  if (!blocks.length) return ''
  const ask = blocks.some((b) => b.category !== 'necessary')
  const google = blocks.some((b) => b.id === 'ga4' || b.id === 'gtm' || /googletagmanager|gtag\(/.test(b.code))
  const out: string[] = []
  // Google learns the consent state before any of its tags: everything denied until a choice.
  if (google && ask)
    out.push(
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});</script>`,
    )
  for (const b of blocks) {
    // Necessary code in the head runs as written; the rest waits, inert, in a <template>.
    if (b.category === 'necessary' && b.place === 'head') out.push(b.code)
    else
      out.push(
        `<template data-mz-code="${attr(b.id)}" data-mz-consent="${b.category}" data-mz-place="${b.place}">${b.code.replace(/<\/template/gi, '<\\/template')}</template>`,
      )
  }
  const lang = (options.lang ?? 'it').startsWith('it') ? 'it' : 'en'
  const texts = {
    ...TEXTS[lang],
    ...(t.banner?.title ? { title: t.banner.title } : {}),
    ...(t.banner?.text ? { text: t.banner.text } : {}),
  }
  const categories = (['analytics', 'marketing'] as const).filter((c) => blocks.some((b) => b.category === c))
  out.push(
    `<style>${bannerCss(options.accent ?? '#111111', t.banner?.position ?? 'bottom')}</style>`,
    `<script>${CONSENT_SCRIPT}(${json({
      ask,
      texts,
      categories,
      policy: t.banner?.policyUrl && /^(https?:\/\/|\/)[^"<>\s]*$/.test(t.banner.policyUrl) ? t.banner.policyUrl : null,
      reopen: ask && t.banner?.reopenButton !== false,
    })});</script>`,
  )
  return out.join('\n')
}

/**
 * Runs in the visitor's browser: remembers the choice (localStorage, a year), starts the code it
 * allows, shows the banner when there is no choice yet, and reopens it from "#preferenze-cookie".
 * Plain JavaScript, written once, so no build step can change it.
 */
const CONSENT_SCRIPT = `(function (cfg) {
  var KEY = 'mz-consent', VERSION = 1, YEAR = 31536000000
  var saved = null
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) {}
  if (saved && (saved.v !== VERSION || Date.now() - saved.at > YEAR)) saved = null
  var started = {}
  function start(category) {
    if (started[category]) return
    started[category] = true
    var tpls = document.querySelectorAll('template[data-mz-consent="' + category + '"]')
    for (var i = 0; i < tpls.length; i++) {
      var tpl = tpls[i]
      var target = tpl.getAttribute('data-mz-place') === 'body' ? document.body : document.head
      var nodes = tpl.content.childNodes
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j]
        if (node.nodeName === 'SCRIPT') {
          // A script from a template does not run when moved: a new one does.
          var s = document.createElement('script')
          for (var k = 0; k < node.attributes.length; k++) s.setAttribute(node.attributes[k].name, node.attributes[k].value)
          s.text = node.text
          target.appendChild(s)
        } else target.appendChild(document.importNode(node, true))
      }
      tpl.parentNode.removeChild(tpl)
    }
  }
  function apply(c) {
    if (window.gtag) window.gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.marketing ? 'granted' : 'denied',
      ad_user_data: c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied'
    })
    if (c.analytics) start('analytics')
    if (c.marketing) start('marketing')
  }
  var box = null
  function close() { if (box) box.remove(); box = null }
  function asked() { return /^#(preferenze-cookie|cookie-preferences)$/.test(location.hash) }
  function save(analytics, marketing) {
    var c = { analytics: analytics, marketing: marketing, v: VERSION, at: Date.now() }
    try { localStorage.setItem(KEY, JSON.stringify(c)) } catch (e) {}
    // Taking back a consent cannot stop code already running: the page starts over without it.
    var withdrawn = saved && ((saved.analytics && !analytics) || (saved.marketing && !marketing))
    saved = c
    close()
    // The choice is made: "#preferenze-cookie" must not open the panel again on reload.
    if (asked()) history.replaceState(null, '', location.pathname + location.search)
    if (withdrawn) location.reload()
    else apply(c)
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag)
    e.className = cls
    if (text) e.textContent = text
    return e
  }
  function show(detailed) {
    close()
    var t = cfg.texts
    box = el('div', 'mz-cc')
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-label', t.title)
    box.appendChild(el('p', 'mz-cc-title', t.title))
    var p = el('p', 'mz-cc-text', t.text)
    if (cfg.policy) {
      var a = el('a', 'mz-cc-link', t.policy)
      a.href = cfg.policy
      p.appendChild(document.createTextNode(' '))
      p.appendChild(a)
    }
    box.appendChild(p)
    var toggles = {}
    if (detailed) {
      var list = el('div', 'mz-cc-list')
      var row = function (key, on, locked) {
        var label = el('label', 'mz-cc-row')
        var input = document.createElement('input')
        input.type = 'checkbox'
        input.checked = on
        input.disabled = locked
        toggles[key] = input
        var words = el('span', '')
        words.appendChild(el('strong', '', t[key]))
        words.appendChild(el('span', 'mz-cc-hint', t[key + 'Hint']))
        label.appendChild(input)
        label.appendChild(words)
        list.appendChild(label)
      }
      row('necessary', true, true)
      for (var i = 0; i < cfg.categories.length; i++) row(cfg.categories[i], !!(saved && saved[cfg.categories[i]]), false)
      box.appendChild(list)
    }
    var buttons = el('div', 'mz-cc-buttons')
    var button = function (text, cls, onClick) {
      var b = el('button', 'mz-cc-button ' + cls, text)
      b.type = 'button'
      b.addEventListener('click', onClick)
      buttons.appendChild(b)
    }
    // Refusing is as easy as accepting: same size, same row.
    button(t.reject, '', function () { save(false, false) })
    if (detailed) button(t.save, '', function () {
      save(!!(toggles.analytics && toggles.analytics.checked), !!(toggles.marketing && toggles.marketing.checked))
    })
    else button(t.customize, '', function () { show(true) })
    button(t.accept, 'mz-cc-primary', function () { save(true, true) })
    box.appendChild(buttons)
    document.body.appendChild(box)
    var first = box.querySelector('button')
    if (first && detailed) first.focus()
  }
  window.mzConsent = { open: function () { show(true) }, choice: function () { return saved } }
  function ready() {
    start('necessary')
    if (!cfg.ask) return
    if (saved) apply(saved)
    if (!saved || asked()) show(asked())
    window.addEventListener('hashchange', function () { if (asked()) show(true) })
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href$="#preferenze-cookie"],a[href$="#cookie-preferences"],[data-mz-consent-open]')
      if (!a) return
      e.preventDefault()
      show(true)
    })
    if (cfg.reopen) {
      var b = el('button', 'mz-cc-reopen', '')
      b.type = 'button'
      b.title = cfg.texts.reopen
      b.setAttribute('aria-label', cfg.texts.reopen)
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/></svg>'
      b.addEventListener('click', function () { show(true) })
      document.body.appendChild(b)
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready)
  else ready()
})`

function bannerCss(accent: string, position: 'bottom' | 'corner'): string {
  const place =
    position === 'corner'
      ? 'left:16px;bottom:16px;max-width:400px'
      : 'left:50%;bottom:16px;transform:translateX(-50%);width:min(720px,calc(100% - 32px))'
  return `.mz-cc{position:fixed;${place};z-index:2147483000;box-sizing:border-box;padding:20px;border-radius:14px;background:#fff;color:#111;box-shadow:0 1px 2px rgba(0,0,0,.08),0 16px 48px rgba(0,0,0,.18);font:14px/1.5 system-ui,-apple-system,sans-serif}
.mz-cc *{box-sizing:border-box}.mz-cc p{margin:0}.mz-cc-title{font-weight:600;font-size:15px;margin-bottom:6px!important}.mz-cc-text{color:#444}.mz-cc-link{color:inherit;text-decoration:underline}
.mz-cc-list{display:grid;gap:10px;margin:14px 0 0}.mz-cc-row{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.mz-cc-row input{margin-top:3px;accent-color:${accent}}.mz-cc-row strong{display:block;font-weight:600}.mz-cc-hint{display:block;color:#666;font-size:13px}
.mz-cc-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;justify-content:flex-end}.mz-cc-button{flex:1 1 auto;min-height:40px;padding:0 16px;border-radius:9px;border:1px solid #d4d4d8;background:#fff;color:#111;font:inherit;font-weight:500;cursor:pointer}.mz-cc-button:hover{background:#f4f4f5}.mz-cc-primary{background:${accent};border-color:${accent};color:#fff}.mz-cc-primary:hover{background:${accent};filter:brightness(1.08)}
.mz-cc-reopen{position:fixed;left:16px;bottom:16px;z-index:2147482999;width:40px;height:40px;border-radius:50%;border:1px solid #d4d4d8;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.12)}
@media (prefers-color-scheme:dark){.mz-cc{background:#18181b;color:#f4f4f5}.mz-cc-text,.mz-cc-hint{color:#a1a1aa}.mz-cc-button{background:#18181b;color:#f4f4f5;border-color:#3f3f46}.mz-cc-button:hover{background:#27272a}.mz-cc-primary{background:${accent};border-color:${accent};color:#fff}.mz-cc-reopen{background:#18181b;color:#e4e4e7;border-color:#3f3f46}}`
}
