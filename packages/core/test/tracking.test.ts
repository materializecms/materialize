import { describe, expect, it } from 'vitest'
import { needsConsent, TRACKING_PATTERNS, trackingHtml } from '../src/tracking.ts'

describe('tracking', () => {
  it('adds nothing without services or code', () => {
    expect(trackingHtml(null)).toBe('')
    expect(trackingHtml({ custom: [{ id: 'a', name: '', place: 'head', category: 'analytics', code: '  ' }] })).toBe('')
  })

  it('holds back analytics until consent, with Google consent denied by default', () => {
    const html = trackingHtml({ ga4: 'G-ABC1234' })
    expect(html).toContain("gtag('consent','default'")
    expect(html).toMatch(/<template data-mz-code="ga4" data-mz-consent="analytics"[^>]*>[\s\S]*G-ABC1234/)
    expect(html).not.toMatch(/^<script async src="https:\/\/www.googletagmanager/m)
    expect(html).toContain('"ask":true')
    expect(needsConsent({ ga4: 'G-ABC1234' })).toBe(true)
  })

  it('runs cookie-free and necessary code without a banner', () => {
    const t = {
      plausible: 'example.com',
      custom: [
        {
          id: 'v',
          name: 'Verifica',
          place: 'head' as const,
          category: 'necessary' as const,
          code: '<meta name="x" content="1">',
        },
      ],
    }
    const html = trackingHtml(t)
    expect(html).toContain('<meta name="x" content="1">')
    expect(html).toContain('"ask":false')
    expect(html).not.toContain("gtag('consent','default'")
    expect(needsConsent(t)).toBe(false)
  })

  it('keeps pasted code from closing its template or the script', () => {
    const html = trackingHtml({
      custom: [{ id: 'x', name: '', place: 'body', category: 'marketing', code: '<script>1</script></template><b>' }],
      banner: { title: '</script><script>alert(1)</script>', policyUrl: 'javascript:alert(1)' },
    })
    expect(html).not.toContain('</template><b>')
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).toContain('"policy":null')
  })

  it('picks the banner words from the page language', () => {
    expect(trackingHtml({ metaPixel: '123456' }, { lang: 'en' })).toContain('Accept all')
    expect(trackingHtml({ metaPixel: '123456' }, { lang: 'it' })).toContain('Accetta tutti')
  })

  it('recognises service ids', () => {
    expect(TRACKING_PATTERNS.ga4.test('G-ABC1234')).toBe(true)
    expect(TRACKING_PATTERNS.ga4.test('UA-1234-1')).toBe(false)
    expect(TRACKING_PATTERNS.gtm.test('GTM-ABCD12')).toBe(true)
  })
})
