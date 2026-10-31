import { newId, type PageNode, type TextStyle } from './page.ts'

/**
 * Ready-made sections, by category and variant: the canvas library. Each build returns fresh ids;
 * images are placeholders until someone picks a picture.
 */

type P = Partial<PageNode>
type Tone = 1 | 2 | 3

export interface LibraryCategory {
  key: string
  label: string
  variants: { key: string; label: string; keywords: string }[]
}

const RAW: [string, string, [string, string, string][]][] = [
  [
    'nav',
    'Navigazione',
    [
      ['classic', 'Classica', 'menu link'],
      ['center', 'Centrata', 'menu'],
      ['minimal', 'Minimale', 'menu hamburger'],
    ],
  ],
  [
    'hero',
    'Hero',
    [
      ['split', 'Testo e immagine', 'apertura'],
      ['center', 'Centrato', 'apertura'],
      ['inverse', 'Scuro', 'apertura'],
      ['cover', 'Foto a tutto schermo', 'apertura sfondo foto'],
    ],
  ],
  ['banner', 'Annuncio', [['bar', 'Barra', 'avviso novità']]],
  [
    'logos',
    'Loghi',
    [
      ['row', 'Fila', 'clienti partner'],
      ['grid', 'Griglia', 'clienti partner'],
    ],
  ],
  [
    'about',
    'Chi siamo',
    [
      ['story', 'Racconto', 'studio storia'],
      ['image', 'Con foto', 'studio storia firma'],
    ],
  ],
  [
    'features',
    'Servizi',
    [
      ['cols', 'Tre colonne', 'funzionalità'],
      ['split', 'Con immagine', 'metodo'],
      ['cards', 'Schede', 'funzionalità card'],
      ['alternating', 'Alternati', 'zig zag foto'],
    ],
  ],
  [
    'process',
    'Processo',
    [
      ['steps', 'Passaggi', 'fasi metodo'],
      ['timeline', 'Cronologia', 'storia anni'],
    ],
  ],
  [
    'stats',
    'Numeri',
    [
      ['row', 'In fila', 'statistiche'],
      ['big', 'Grandi', 'statistiche'],
    ],
  ],
  [
    'gallery',
    'Progetti',
    [
      ['grid', 'Griglia', 'portfolio lavori'],
      ['feature', 'Due colonne', 'portfolio'],
      ['masonry', 'Mosaico', 'portfolio foto'],
      ['list', 'Elenco', 'portfolio indice'],
    ],
  ],
  ['media', 'Video', [['video', 'Video', 'filmato']]],
  [
    'testimonial',
    'Testimonianze',
    [
      ['quote', 'Citazione', 'recensione'],
      ['cards', 'Schede', 'recensioni'],
      ['split', 'Con foto', 'recensione'],
    ],
  ],
  ['awards', 'Premi e stampa', [['list', 'Elenco', 'riconoscimenti pubblicazioni']]],
  [
    'pricing',
    'Formule',
    [
      ['three', 'Tre colonne', 'prezzi piani'],
      ['two', 'Due colonne', 'prezzi piani'],
    ],
  ],
  [
    'team',
    'Team',
    [
      ['grid', 'Griglia', 'persone'],
      ['list', 'Elenco', 'persone'],
    ],
  ],
  ['blog', 'Articoli', [['grid', 'Griglia', 'blog notizie diario']]],
  [
    'faq',
    'FAQ',
    [
      ['list', 'Elenco', 'domande'],
      ['grid', 'Griglia', 'domande'],
    ],
  ],
  [
    'contact',
    'Contatti',
    [
      ['form', 'Con modulo', 'modulo di contatto form email messaggio richiesta preventivo'],
      ['simple', 'Essenziale', 'email'],
      ['locations', 'Sedi', 'indirizzi mappa'],
    ],
  ],
  [
    'cta',
    'Invito',
    [
      ['banner', 'Banner scuro', 'call to action'],
      ['accent', 'Accento', 'call to action'],
      ['split', 'Con foto', 'call to action'],
      ['newsletter', 'Newsletter', 'iscrizione email'],
    ],
  ],
  [
    'divider',
    'Separatori',
    [
      ['statement', 'Frase', 'manifesto'],
      ['line', 'Linea', 'spazio'],
    ],
  ],
  [
    'footer',
    'Footer',
    [
      ['simple', 'Semplice', 'piè di pagina'],
      ['columns', 'Colonne', 'piè di pagina'],
      ['big', 'Grande', 'piè di pagina'],
    ],
  ],
]

export const LIBRARY: LibraryCategory[] = RAW.map(([key, label, variants]) => ({
  key,
  label,
  variants: variants.map(([v, l, k]) => ({ key: `${key}.${v}`, label: l, keywords: k })),
}))

/** Schematic thumbnails: rectangles on a 120×72 grid (x, y, w, h, tone). */
export const LIBRARY_THUMBS: Record<string, string> = {
  'nav.classic': '8,32,24,7,i;66,33,9,4,m;79,33,9,4,m;92,33,9,4,m;104,31,10,8,i',
  'nav.center': '44,20,32,8,i;34,42,10,4,m;48,42,10,4,m;62,42,10,4,m;76,42,10,4,m',
  'hero.split': '8,14,14,3,m;8,21,46,8,i;8,31,38,8,i;8,44,42,3,m;8,49,34,3,m;8,57,16,7,a;64,10,48,52,p',
  'hero.center': '48,8,24,3,m;24,14,72,8,i;34,25,52,3,m;52,32,16,6,a;10,42,100,26,p',
  'hero.inverse': '0,0,120,72,i;8,12,60,8,w;8,24,44,3,w;8,32,16,6,a;8,44,104,22,p',
  'logos.row': '36,16,48,3,m;8,34,18,8,p;30,34,18,8,p;52,34,18,8,p;74,34,18,8,p;96,34,18,8,p',
  'features.cols':
    '8,10,16,3,m;8,16,50,7,i;8,36,30,2,m;8,41,20,5,i;8,49,30,3,m;45,36,30,2,m;45,41,20,5,i;45,49,30,3,m;82,36,30,2,m;82,41,20,5,i;82,49,30,3,m',
  'features.split': '8,10,50,52,p;66,12,40,7,i;66,28,30,4,i;66,35,44,3,m;66,44,30,4,i;66,51,44,3,m',
  'stats.row': '0,0,120,72,s;8,24,24,10,i;8,38,26,3,m;46,24,24,10,i;46,38,26,3,m;84,24,24,10,i;84,38,26,3,m',
  'gallery.grid': '8,8,40,6,i;8,22,32,26,p;44,22,32,26,p;80,22,32,26,p;8,52,20,3,i;44,52,20,3,i;80,52,20,3,i',
  'gallery.feature': '8,8,40,6,i;8,20,50,44,p;62,20,50,20,p;62,44,50,20,p',
  'testimonial.quote': '0,0,120,72,s;20,22,80,6,i;28,32,64,6,i;46,46,28,3,m',
  'pricing.three': '8,8,40,6,i;8,22,32,42,m;44,22,32,42,i;80,22,32,42,m',
  'faq.list': '8,12,36,7,i;8,24,30,3,m;56,12,56,4,i;56,20,50,2,m;56,30,56,4,i;56,38,50,2,m;56,48,56,4,i;56,56,50,2,m',
  'team.grid':
    '8,8,40,6,i;8,20,22,30,p;35,20,22,30,p;62,20,22,30,p;89,20,22,30,p;8,54,16,3,i;35,54,16,3,i;62,54,16,3,i;89,54,16,3,i',
  'contact.form':
    '8,14,44,7,i;8,26,40,3,m;8,32,32,3,m;62,8,50,56,m;68,16,38,6,w;68,28,38,6,w;68,40,38,10,w;68,55,16,5,a',
  'cta.banner': '0,0,120,72,i;30,22,60,8,w;38,35,44,3,w;50,45,20,7,a',
  'cta.accent': '0,0,120,72,a;8,26,60,8,w;8,38,44,3,w;92,30,20,8,w',
  'footer.simple': '8,30,30,7,i;8,41,24,3,m;70,33,10,3,m;84,33,10,3,m;98,33,10,3,m',
  'footer.columns':
    '0,0,120,72,s;8,18,26,6,i;8,28,22,3,m;48,18,14,3,i;48,25,16,2,m;48,30,16,2,m;72,18,14,3,i;72,25,16,2,m;72,30,16,2,m;96,18,14,3,i;96,25,16,2,m',
  'nav.minimal': '8,32,24,7,i;80,30,14,10,m;98,30,14,10,i',
  'hero.cover': '0,0,120,72,p;8,26,62,8,w;8,38,44,3,w;8,46,18,7,a',
  'banner.bar': '0,26,120,20,a;24,34,50,4,w;80,34,16,4,w',
  'logos.grid':
    '8,14,30,10,p;45,14,30,10,p;82,14,30,10,p;8,30,30,10,p;45,30,30,10,p;82,30,30,10,p;8,46,30,10,p;45,46,30,10,p;82,46,30,10,p',
  'about.story': '8,10,16,3,m;8,16,90,7,i;8,26,70,7,i;8,42,48,3,m;8,48,44,3,m;64,42,48,3,m;64,48,44,3,m',
  'about.image': '8,8,44,56,p;60,14,16,3,m;60,20,50,7,i;60,32,48,3,m;60,38,44,3,m;60,50,30,3,i',
  'features.cards': '8,8,40,6,i;8,22,32,40,s;44,22,32,40,s;80,22,32,40,s;12,28,8,6,a;48,28,8,6,a;84,28,8,6,a',
  'features.alternating': '8,6,50,28,p;66,12,40,6,i;66,22,44,3,m;8,44,40,6,i;8,54,44,3,m;62,38,50,28,p',
  'process.steps':
    '8,8,40,6,i;8,26,22,2,m;8,32,18,5,i;8,40,22,3,m;36,26,22,2,m;36,32,18,5,i;36,40,22,3,m;64,26,22,2,m;64,32,18,5,i;64,40,22,3,m;92,26,22,2,m;92,32,18,5,i;92,40,22,3,m',
  'process.timeline':
    '8,12,36,7,i;8,24,30,3,m;56,12,12,4,a;72,12,40,3,m;56,28,12,4,a;72,28,40,3,m;56,44,12,4,a;72,44,40,3,m',
  'stats.big': '0,0,120,72,i;10,18,36,18,w;10,42,40,3,w;66,18,36,18,w;66,42,40,3,w',
  'gallery.masonry': '8,8,32,30,p;44,8,32,22,p;80,8,32,34,p;8,42,32,24,p;44,34,32,32,p;80,46,32,20,p',
  'gallery.list':
    '8,8,40,6,i;8,22,40,4,i;80,22,30,3,m;8,34,40,4,i;80,34,30,3,m;8,46,40,4,i;80,46,30,3,m;8,58,40,4,i;80,58,30,3,m',
  'media.video': '8,8,104,46,p;52,24,16,14,w;8,60,40,4,i;84,58,28,7,i',
  'testimonial.cards': '0,0,120,72,s;8,8,40,6,i;8,22,32,40,w;44,22,32,40,w;80,22,32,40,w',
  'testimonial.split': '8,8,44,56,p;60,22,52,6,i;60,32,44,6,i;60,46,26,3,m',
  'awards.list':
    '8,8,46,6,i;8,22,10,3,a;24,22,50,3,i;90,22,22,3,m;8,34,10,3,a;24,34,50,3,i;90,34,22,3,m;8,46,10,3,a;24,46,50,3,i;90,46,22,3,m',
  'pricing.two': '8,8,40,6,i;8,22,50,42,m;62,22,50,42,i',
  'team.list': '8,8,40,6,i;8,24,40,4,i;80,24,30,3,m;8,36,40,4,i;80,36,30,3,m;8,48,40,4,i;80,48,30,3,m',
  'blog.grid':
    '8,8,40,6,i;8,20,32,22,p;44,20,32,22,p;80,20,32,22,p;8,46,20,2,m;44,46,20,2,m;80,46,20,2,m;8,51,28,4,i;44,51,28,4,i;80,51,28,4,i',
  'faq.grid':
    '8,8,40,6,i;8,24,46,4,i;8,31,46,2,m;62,24,46,4,i;62,31,46,2,m;8,44,46,4,i;8,51,46,2,m;62,44,46,4,i;62,51,46,2,m',
  'contact.simple': '48,14,24,3,m;20,22,80,8,i;34,36,52,3,m;50,44,20,7,a',
  'contact.locations': '8,8,40,6,i;8,20,50,26,p;62,20,50,26,p;8,50,20,4,i;8,57,30,3,m;62,50,20,4,i;62,57,30,3,m',
  'cta.split': '0,0,120,72,s;8,20,50,7,i;8,32,40,3,m;8,40,18,7,a;66,10,46,52,p',
  'cta.newsletter': '30,16,60,7,i;36,28,48,3,m;30,40,42,9,s;76,40,16,9,a',
  'divider.statement': '14,24,92,8,i;24,36,72,8,i',
  'divider.line': '8,35,104,1.5,m',
  'footer.big': '0,0,120,72,i;8,14,80,14,w;8,44,40,3,w;72,44,10,3,w;86,44,10,3,w;100,44,10,3,w',
}

export function thumbRects(key: string) {
  return (LIBRARY_THUMBS[key] ?? '')
    .split(';')
    .filter(Boolean)
    .map((s) => {
      const [x, y, w, h, c] = s.split(',')
      return { x: Number(x), y: Number(y), w: Number(w), h: Number(h), tone: c as 'i' | 'm' | 'p' | 'a' | 's' | 'w' }
    })
}

const F = (name: string, p: P, children: PageNode[] = []): PageNode => ({
  id: newId(),
  type: 'frame',
  name,
  layout: 'col',
  gap: 16,
  align: 'start',
  justify: 'start',
  width: 'fill',
  ...p,
  children,
})
/** Big numbers, prices, marquee words and logos look like headings but are not: plain paragraphs. */
const DECORATIVE = new Set(['v', 'n', 'price', 'word', 'logo'])

const T = (role: string, name: string, text: string, style: TextStyle, p: P = {}): PageNode => ({
  id: newId(),
  type: 'text',
  name,
  text,
  style,
  ...(DECORATIVE.has(role) && style !== 'body' && style !== 'small' ? { tag: 'p' as const } : {}),
  color: 'text',
  talign: 'left',
  width: 'fill',
  ...p,
})
const I = (_role: string, name: string, p: P = {}): PageNode => ({
  id: newId(),
  type: 'image',
  name,
  src: null,
  alt: '',
  ratio: '4/3',
  tone: 1,
  fit: 'cover',
  width: 'fill',
  radius: 'card',
  ...p,
})
const B = (_role: string, name: string, text: string, variant: PageNode['variant'], p: P = {}): PageNode => ({
  id: newId(),
  type: 'button',
  name,
  text,
  variant,
  style: 'button',
  href: '/contatti',
  width: 'hug',
  padX: 24,
  padY: 14,
  radius: 'btn',
  ...p,
})

/** Builds a section from the library ("hero.split"); `brand` replaces the sample studio name. */
export function buildSection(key: string, brand = 'Studio Rossi'): PageNode {
  const S = (n: string, p: P, k: PageNode[]) => F(n, { section: key, scheme: 'default', size: 'm', gap: 48, ...p }, k)
  const mono = (t: string) => T('n', 'Numero', t, 'eyebrow', { color: 'muted' })
  if (key === 'nav.classic')
    return S(
      'Navigazione',
      { layout: 'row', justify: 'between', align: 'center', size: 'xs', gap: 24, divider: true, mobileMenu: true },
      [
        T('logo', 'Logo', brand, 'logo', { width: 'hug' }),
        F('Link', { layout: 'row', gap: 28, width: 'hug', align: 'center', over: { mobile: { hidden: true } } }, [
          T('link1', 'Link', 'Progetti', 'small', { width: 'hug' }),
          T('link2', 'Link', 'Studio', 'small', { width: 'hug' }),
          T('link3', 'Link', 'Contatti', 'small', { width: 'hug' }),
        ]),
        B('cta', 'Pulsante', 'Prenota una call', 'secondary', { padY: 11, padX: 18 }),
      ],
    )
  if (key === 'nav.center')
    return S('Navigazione', { align: 'center', size: 'xs', gap: 14, divider: true }, [
      T('logo', 'Logo', brand, 'logo', { width: 'hug', talign: 'center' }),
      F('Link', { layout: 'row', gap: 28, width: 'hug', align: 'center', wrap: true, justify: 'center' }, [
        T('link1', 'Link', 'Progetti', 'small', { width: 'hug' }),
        T('link2', 'Link', 'Studio', 'small', { width: 'hug' }),
        T('link3', 'Link', 'Contatti', 'small', { width: 'hug' }),
      ]),
    ])
  if (key === 'hero.split')
    return S(
      'Hero',
      { layout: 'row', gap: 64, align: 'center', size: 'l', over: { mobile: { layout: 'col', gap: 40 } } },
      [
        F('Testo', { gap: 24 }, [
          T('eyebrow', 'Etichetta', 'Studio di architettura · Milano', 'eyebrow', { color: 'muted' }),
          T('title', 'Titolo', 'Spazi che respirano.', 'display', { anim: 'up' }),
          T(
            'subtitle',
            'Sottotitolo',
            'Progettiamo case e luoghi di lavoro luminosi, sostenibili e costruiti per durare.',
            'body',
            { color: 'muted', maxW: 480 },
          ),
          F('Azioni', { layout: 'row', gap: 12, width: 'hug', wrap: true, padY: 8 }, [
            B('cta', 'Pulsante', 'Scopri i progetti', 'primary'),
            B('cta2', 'Pulsante', 'Lo studio', 'ghost'),
          ]),
        ]),
        I('image', 'Immagine', { ratio: '4/5', tone: 1, anim: 'fade' }),
      ],
    )
  if (key === 'hero.center')
    return S('Hero', { align: 'center', gap: 56, size: 'l' }, [
      F('Testo', { gap: 22, align: 'center', maxW: 860 }, [
        T('eyebrow', 'Etichetta', 'Studio di architettura · Milano', 'eyebrow', { color: 'muted', talign: 'center' }),
        T('title', 'Titolo', 'Spazi che respirano.', 'display', { talign: 'center' }),
        T(
          'subtitle',
          'Sottotitolo',
          'Progettiamo case e luoghi di lavoro luminosi, sostenibili e costruiti per durare.',
          'body',
          { color: 'muted', maxW: 560, talign: 'center' },
        ),
        F('Azioni', { layout: 'row', gap: 12, width: 'hug', wrap: true, justify: 'center', padY: 8 }, [
          B('cta', 'Pulsante', 'Scopri i progetti', 'primary'),
          B('cta2', 'Pulsante', 'Lo studio', 'ghost'),
        ]),
      ]),
      I('image', 'Immagine', { ratio: '21/9', tone: 1, over: { mobile: { ratio: '4/3' } } }),
    ])
  if (key === 'hero.inverse')
    return S('Hero', { scheme: 'inverse', gap: 48, size: 'l' }, [
      F('Testo', { gap: 22, maxW: 820 }, [
        T('eyebrow', 'Etichetta', 'Studio di architettura · Milano', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Architettura che accoglie la luce.', 'display'),
        T(
          'subtitle',
          'Sottotitolo',
          'Progettiamo case e luoghi di lavoro luminosi, sostenibili e costruiti per durare.',
          'body',
          { color: 'muted', maxW: 540 },
        ),
        F('Azioni', { layout: 'row', gap: 12, width: 'hug', wrap: true, padY: 8 }, [
          B('cta', 'Pulsante', 'Guarda i progetti', 'primary'),
        ]),
      ]),
      I('image', 'Immagine', { ratio: '16/7', tone: 2, over: { mobile: { ratio: '4/3' } } }),
    ])
  if (key === 'logos.row')
    return S('Loghi', { align: 'center', gap: 28, size: 's' }, [
      T('label', 'Etichetta', 'Partner e fornitori con cui lavoriamo', 'small', { color: 'muted', talign: 'center' }),
      F(
        'Loghi',
        { layout: 'row', wrap: true, gap: 40, justify: 'center', align: 'center' },
        [1, 2, 3, 4, 5].map(() => I('logo', 'Logo', { ratio: '3/1', width: 'fixed', fixedW: 120, tone: 3, radius: 4 })),
      ),
    ])
  if (key === 'features.cols')
    return S('Servizi', { gap: 56 }, [
      F('Intestazione', { gap: 14, maxW: 680 }, [
        T('eyebrow', 'Etichetta', 'Servizi', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Dal progetto al cantiere, un solo interlocutore.', 'h2'),
        T(
          'subtitle',
          'Sottotitolo',
          'Seguiamo ogni fase, dallo studio di fattibilità alla consegna delle chiavi.',
          'body',
          {
            color: 'muted',
            runs: [
              { t: 'Seguiamo ' },
              { t: 'ogni fase', b: true },
              { t: ', dallo studio di fattibilità alla ' },
              { t: 'consegna delle chiavi', href: '/contatti' },
              { t: '.' },
            ],
          },
        ),
      ]),
      F('Griglia', { layout: 'grid', cols: 3, gap: 40, over: { tablet: { cols: 2 }, mobile: { cols: 1, gap: 8 } } }, [
        F('Servizio', { gap: 10, padY: 24, topline: true }, [
          mono('01'),
          T('h', 'Titolo', 'Residenziale', 'h3'),
          T('p', 'Testo', 'Case unifamiliari e appartamenti, dal concept al cantiere.', 'body', { color: 'muted' }),
        ]),
        F('Servizio', { gap: 10, padY: 24, topline: true }, [
          mono('02'),
          T('h', 'Titolo', 'Interni', 'h3'),
          T('p', 'Testo', 'Arredi su misura, luce e materiali scelti con cura.', 'body', { color: 'muted' }),
        ]),
        F('Servizio', { gap: 10, padY: 24, topline: true }, [
          mono('03'),
          T('h', 'Titolo', 'Ristrutturazioni', 'h3'),
          T('p', 'Testo', 'Recupero di edifici esistenti, con attenzione all’energia.', 'body', { color: 'muted' }),
        ]),
      ]),
    ])
  if (key === 'features.split')
    return S('Servizi', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 40 } } }, [
      I('image', 'Immagine', { ratio: '1/1', tone: 2 }),
      F('Testo', { gap: 24 }, [
        T('eyebrow', 'Etichetta', 'Metodo', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Un processo chiaro, in tre passaggi.', 'h2'),
        F('Passaggio', { gap: 6, padY: 18, topline: true }, [
          T('h', 'Titolo', 'Ascolto', 'h3'),
          T('p', 'Testo', 'Capiamo come vivi e lavori, prima di disegnare.', 'body', { color: 'muted' }),
        ]),
        F('Passaggio', { gap: 6, padY: 18, topline: true }, [
          T('h', 'Titolo', 'Progetto', 'h3'),
          T('p', 'Testo', 'Disegni, materiali e costi chiari fin dall’inizio.', 'body', { color: 'muted' }),
        ]),
        F('Passaggio', { gap: 6, padY: 18, topline: true }, [
          T('h', 'Titolo', 'Cantiere', 'h3'),
          T('p', 'Testo', 'Un referente unico fino alla consegna delle chiavi.', 'body', { color: 'muted' }),
        ]),
      ]),
    ])
  if (key === 'stats.row')
    return S('Numeri', { scheme: 'surface' }, [
      F('Numeri', { layout: 'grid', cols: 3, gap: 32, over: { mobile: { cols: 1 } } }, [
        F('Numero', { gap: 6 }, [
          T('v', 'Valore', '15', 'h1'),
          T('l', 'Descrizione', 'anni di attività', 'body', { color: 'muted' }),
        ]),
        F('Numero', { gap: 6 }, [
          T('v', 'Valore', '120+', 'h1'),
          T('l', 'Descrizione', 'progetti consegnati', 'body', { color: 'muted' }),
        ]),
        F('Numero', { gap: 6 }, [
          T('v', 'Valore', '3', 'h1'),
          T('l', 'Descrizione', 'premi di architettura', 'body', { color: 'muted' }),
        ]),
      ]),
    ])
  const proj = (n: string, t: string, tone: Tone, ratio: string) =>
    F('Progetto', { gap: 12, hover: 'zoomimg' }, [
      I('image', 'Immagine', { ratio: ratio, tone: tone }),
      T('h', 'Titolo', n, 'h3'),
      T('p', 'Dettagli', t, 'small', { color: 'muted' }),
    ])
  if (key === 'gallery.grid')
    return S('Progetti', { gap: 40 }, [
      F('Intestazione', { layout: 'row', justify: 'between', align: 'end', gap: 24, wrap: true }, [
        F('Titoli', { gap: 12 }, [
          T('title', 'Titolo', 'Progetti recenti', 'h2'),
          T('subtitle', 'Sottotitolo', 'Una selezione dei lavori degli ultimi anni.', 'body', { color: 'muted' }),
        ]),
        B('cta', 'Pulsante', 'Tutti i progetti', 'ghost'),
      ]),
      F(
        'Griglia',
        {
          layout: 'grid',
          cols: 3,
          gap: 24,
          anim: 'up',
          stagger: true,
          animTrig: 'scroll',
          over: { tablet: { cols: 2 }, mobile: { cols: 1 } },
        },
        [
          proj('Casa sul lago', 'Residenziale · Como', 1, '4/3'),
          proj('Loft Navigli', 'Interni · Milano', 2, '4/3'),
          proj('Uffici Brera', 'Ristrutturazione · Milano', 3, '4/3'),
        ],
      ),
    ])
  if (key === 'gallery.feature')
    return S('Progetti', { gap: 36 }, [
      T('title', 'Titolo', 'Lavori selezionati', 'h2'),
      F('Griglia', { layout: 'grid', cols: 2, gap: 24, over: { mobile: { cols: 1 } } }, [
        proj('Casa sul lago', 'Residenziale · Como', 1, '1/1'),
        proj('Loft Navigli', 'Interni · Milano', 2, '1/1'),
        proj('Uffici Brera', 'Ristrutturazione · Milano', 3, '1/1'),
        proj('Villa sui colli', 'Residenziale · Bergamo', 1, '1/1'),
      ]),
    ])
  if (key === 'testimonial.quote')
    return S('Citazione', { scheme: 'surface', align: 'center', gap: 28, size: 'l' }, [
      T('quote', 'Citazione', '“Hanno capito come volevamo vivere la casa prima ancora che lo sapessimo noi.”', 'h2', {
        talign: 'center',
        maxW: 880,
      }),
      T('author', 'Autore', 'Giulia e Marco · Casa sul lago', 'small', { color: 'muted', talign: 'center' }),
    ])
  const plan = (n: string, price: string, d: string, hl: boolean) =>
    F('Formula', { gap: 16, padX: 28, padY: 28, radius: 'card', border: !hl, scheme: hl ? 'inverse' : null }, [
      T('h', 'Nome', n, 'h3'),
      T('price', 'Prezzo', price, 'h1'),
      T('p', 'Descrizione', d, 'body', { color: 'muted' }),
      B('cta', 'Pulsante', hl ? 'Inizia ora' : 'Richiedi informazioni', hl ? 'primary' : 'ghost'),
    ])
  if (key === 'pricing.three')
    return S('Formule', { gap: 48 }, [
      F('Intestazione', { gap: 12, maxW: 620 }, [
        T('eyebrow', 'Etichetta', 'Formule', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Scegli come lavorare con noi.', 'h2'),
      ]),
      F(
        'Formule',
        { layout: 'grid', cols: 3, gap: 20, align: 'stretch', over: { tablet: { cols: 1 }, mobile: { cols: 1 } } },
        [
          plan('Consulenza', '450 €', 'Due ore con un architetto per valutare il tuo spazio.', false),
          plan('Progetto', 'Su misura', 'Progetto completo, pratiche e computo dei costi.', true),
          plan('Chiavi in mano', 'Su misura', 'Progetto, direzione lavori e consegna finale.', false),
        ],
      ),
    ])
  const qa = (q: string, a: string) =>
    F('Domanda', { gap: 8, padY: 22, divider: true }, [
      T('h', 'Domanda', q, 'h3'),
      T('p', 'Risposta', a, 'body', { color: 'muted' }),
    ])
  if (key === 'faq.list')
    return S('FAQ', { layout: 'row', gap: 64, over: { mobile: { layout: 'col', gap: 24 } } }, [
      F('Intestazione', { gap: 14, maxW: 380 }, [
        T('title', 'Titolo', 'Domande frequenti', 'h2'),
        T('subtitle', 'Sottotitolo', 'Se non trovi la risposta, scrivici.', 'body', { color: 'muted' }),
      ]),
      F('Domande', { gap: 0 }, [
        qa('Quanto dura un progetto?', 'Dipende dalla complessità: in genere da tre a dodici mesi, cantiere escluso.'),
        qa('Seguite anche il cantiere?', 'Sì, con la direzione lavori e un referente unico per tutta la durata.'),
        qa('Lavorate fuori Milano?', 'Sì, in Lombardia e, per progetti selezionati, nel resto d’Italia.'),
        qa('Come si parte?', 'Con un sopralluogo e una conversazione, senza impegno.'),
      ]),
    ])
  const person = (n: string, r: string, tone: Tone) =>
    F('Persona', { gap: 10 }, [
      I('image', 'Foto', { ratio: '3/4', tone: tone }),
      T('h', 'Nome', n, 'h3'),
      T('p', 'Ruolo', r, 'small', { color: 'muted' }),
    ])
  if (key === 'team.grid')
    return S('Team', { gap: 40 }, [
      F('Intestazione', { gap: 12, maxW: 620 }, [
        T('eyebrow', 'Etichetta', 'Studio', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Le persone dietro i progetti.', 'h2'),
      ]),
      F('Griglia', { layout: 'grid', cols: 4, gap: 24, over: { tablet: { cols: 2 }, mobile: { cols: 2, gap: 16 } } }, [
        person('Elena Moretti', 'Fondatrice, architetta', 1),
        person('Luca Bianchi', 'Architetto', 2),
        person('Sara Conti', 'Interior designer', 3),
        person('Davide Ferri', 'Direzione lavori', 1),
      ]),
    ])
  // A real contact form: what is sent arrives in the panel (Impostazioni → Messaggi) and by email.
  const field = (label: string, fieldName: string, inputKind: PageNode['inputKind'], p: P = {}): PageNode => ({
    id: newId(),
    type: 'input',
    name: label,
    text: label,
    fieldName,
    inputKind,
    width: 'fill',
    ...p,
  })
  if (key === 'contact.form')
    return S('Contatti', { layout: 'row', gap: 64, over: { mobile: { layout: 'col', gap: 32 } } }, [
      F('Testo', { gap: 16 }, [
        T('eyebrow', 'Etichetta', 'Contatti', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Parliamo del tuo progetto.', 'h2'),
        T('subtitle', 'Sottotitolo', 'Rispondiamo entro due giorni lavorativi.', 'body', { color: 'muted' }),
        T('address', 'Indirizzo', 'Via [indirizzo] · Milano', 'small'),
      ]),
      F(
        'Modulo',
        {
          gap: 16,
          padX: 32,
          padY: 32,
          radius: 'card',
          scheme: 'surface',
          form: { subject: 'Richiesta dal sito', success: 'Grazie! Ti rispondiamo entro due giorni lavorativi.' },
        },
        [
          field('Nome', 'nome', 'text', { required: true, placeholder: 'Il tuo nome' }),
          field('Email', 'email', 'email', { required: true, placeholder: 'nome@example.com' }),
          field('Tipo di progetto', 'progetto', 'select', {
            options: ['Casa nuova', 'Ristrutturazione', 'Interni', 'Altro'],
          }),
          field('Messaggio', 'messaggio', 'textarea', { placeholder: 'Raccontaci il tuo spazio…' }),
          field('Acconsento a essere ricontattato', 'privacy', 'checkbox', { required: true }),
          B('cta', 'Pulsante', 'Invia richiesta', 'primary', { submit: true }),
        ],
      ),
    ])
  if (key === 'cta.banner')
    return S('Invito', { scheme: 'inverse', align: 'center', gap: 22, size: 'l' }, [
      T('title', 'Titolo', 'Hai un progetto in mente?', 'h1', { talign: 'center', maxW: 760 }),
      T('subtitle', 'Sottotitolo', 'Partiamo da un sopralluogo e da una conversazione.', 'body', {
        color: 'muted',
        talign: 'center',
        maxW: 520,
      }),
      F('Azioni', { layout: 'row', gap: 12, width: 'hug', wrap: true, justify: 'center', padY: 10 }, [
        B('cta', 'Pulsante', 'Parliamone', 'primary'),
        B('cta2', 'Pulsante', 'Vedi i progetti', 'ghost'),
      ]),
    ])
  if (key === 'cta.accent')
    return S(
      'Invito',
      {
        scheme: 'accent',
        layout: 'row',
        justify: 'between',
        align: 'center',
        gap: 32,
        wrap: true,
        over: { mobile: { layout: 'col', align: 'start' } },
      },
      [
        F('Testo', { gap: 10, maxW: 640 }, [
          T('title', 'Titolo', 'Iniziamo a progettare insieme.', 'h2'),
          T('subtitle', 'Sottotitolo', 'Scrivici due righe sul tuo spazio.', 'body', { color: 'muted' }),
        ]),
        B('cta', 'Pulsante', 'Contattaci', 'primary'),
      ],
    )
  if (key === 'footer.simple')
    return S(
      'Footer',
      { layout: 'row', justify: 'between', align: 'center', wrap: true, gap: 24, size: 's', topline: true },
      [
        F('Marchio', { gap: 4, width: 'hug' }, [
          T('logo', 'Logo', brand, 'logo', { width: 'hug' }),
          T('subtitle', 'Sottotitolo', 'Studio di architettura · Milano', 'small', { color: 'muted', width: 'hug' }),
        ]),
        F('Link', { layout: 'row', gap: 24, width: 'hug' }, [
          T('l1', 'Link', 'Instagram', 'small', { width: 'hug' }),
          T('l2', 'Link', 'LinkedIn', 'small', { width: 'hug' }),
          T('l3', 'Link', 'Privacy', 'small', { width: 'hug' }),
        ]),
      ],
    )
  const col = (h: string, a: string, b: string, c: string) =>
    F('Colonna', { gap: 10 }, [
      T('h', 'Titolo', h, 'small', { weight: 600 }),
      T('a', 'Link', a, 'small', { color: 'muted' }),
      T('b', 'Link', b, 'small', { color: 'muted' }),
      T('c', 'Link', c, 'small', { color: 'muted' }),
    ])
  if (key === 'footer.columns')
    return S('Footer', { scheme: 'surface', gap: 40, size: 'm' }, [
      F('Colonne', { layout: 'grid', cols: 4, gap: 32, over: { mobile: { cols: 2 } } }, [
        F('Marchio', { gap: 8 }, [
          T('logo', 'Logo', brand, 'logo'),
          T('subtitle', 'Sottotitolo', 'Studio di architettura a Milano.', 'small', { color: 'muted' }),
        ]),
        col('Studio', 'Chi siamo', 'Metodo', 'Lavora con noi'),
        col('Progetti', 'Residenziale', 'Interni', 'Ristrutturazioni'),
        col('Contatti', 'Milano', 'Instagram', 'LinkedIn'),
      ]),
      T('legal', 'Note legali', '© Studio Rossi · P.IVA [numero]', 'small', { color: 'muted' }),
    ])
  if (key === 'nav.minimal')
    return S(
      'Navigazione',
      { layout: 'row', justify: 'between', align: 'center', size: 'xs', gap: 16, divider: true },
      [
        T('logo', 'Logo', brand, 'logo', { width: 'hug' }),
        F('Azioni', { layout: 'row', gap: 10, width: 'hug', align: 'center' }, [
          B('cta', 'Pulsante', 'Contatti', 'ghost', { padY: 10, padX: 18 }),
          B('menu', 'Pulsante', 'Menu', 'secondary', { padY: 10, padX: 18 }),
        ]),
      ],
    )
  if (key === 'hero.cover')
    return S('Hero', { bgImage: null, bgDim: 0.45, scheme: 'inverse', gap: 24, size: 'l' }, [
      F('Testo', { gap: 22, maxW: 780, padY: 80, anim: 'up', stagger: true }, [
        T('eyebrow', 'Etichetta', 'Studio di architettura · Milano', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Case che durano più di una moda.', 'display'),
        T(
          'subtitle',
          'Sottotitolo',
          'Progettiamo case e luoghi di lavoro luminosi, sostenibili e costruiti per durare.',
          'body',
          { color: 'muted', maxW: 520 },
        ),
        F('Azioni', { layout: 'row', gap: 12, width: 'hug', wrap: true, padY: 8 }, [
          B('cta', 'Pulsante', 'Scopri i progetti', 'primary'),
          B('cta2', 'Pulsante', 'Lo studio', 'ghost'),
        ]),
      ]),
    ])
  if (key === 'banner.bar')
    return S(
      'Annuncio',
      { scheme: 'accent', layout: 'row', justify: 'center', align: 'center', gap: 14, wrap: true, size: 'xs' },
      [
        T('text', 'Testo', 'Novità: apriamo una seconda sede a Como.', 'small', { width: 'hug' }),
        T('link', 'Link', 'Scopri di più', 'small', {
          width: 'hug',
          weight: 600,
          runs: [{ t: 'Scopri di più', href: '/studio' }],
        }),
      ],
    )
  if (key === 'logos.grid')
    return S('Loghi', { gap: 32, size: 'm' }, [
      T('label', 'Etichetta', 'Hanno lavorato con noi', 'eyebrow', { color: 'muted', talign: 'center' }),
      F(
        'Griglia',
        { layout: 'grid', cols: 3, gap: 16, over: { mobile: { cols: 2 } } },
        [1, 2, 3, 4, 5, 6].map(() => I('logo', 'Logo', { ratio: '3/1', tone: 3, radius: 6 })),
      ),
    ])
  if (key === 'about.story')
    return S('Chi siamo', { gap: 32 }, [
      T('eyebrow', 'Etichetta', 'Lo studio', 'eyebrow', { color: 'muted' }),
      T('title', 'Titolo', 'Progettiamo dal 2010 spazi in cui le persone stanno bene.', 'h2', { maxW: 860 }),
      F('Colonne', { layout: 'grid', cols: 2, gap: 40, over: { mobile: { cols: 1, gap: 16 } } }, [
        T(
          'p1',
          'Testo',
          'Siamo un piccolo studio di architetti e interior designer. Lavoriamo su pochi progetti alla volta, per seguirli davvero dall’inizio alla fine.',
          'body',
          { color: 'muted' },
        ),
        T(
          'p2',
          'Testo',
          'Crediamo in materiali onesti, luce naturale e costi chiari. Ogni casa che progettiamo deve poter invecchiare bene insieme a chi la abita.',
          'body',
          { color: 'muted' },
        ),
      ]),
    ])
  if (key === 'about.image')
    return S('Chi siamo', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
      I('image', 'Immagine', { ratio: '3/4' }),
      F('Testo', { gap: 18 }, [
        T('eyebrow', 'Etichetta', 'Lo studio', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Pochi progetti, seguiti fino all’ultimo dettaglio.', 'h2'),
        T(
          'subtitle',
          'Sottotitolo',
          'Dal primo sopralluogo alla consegna delle chiavi hai sempre lo stesso interlocutore: chi ha disegnato la tua casa.',
          'body',
          { color: 'muted' },
        ),
        T('sign', 'Firma', 'Elena Moretti, fondatrice', 'small', { weight: 600 }),
      ]),
    ])
  if (key === 'features.cards')
    return S('Servizi', { gap: 48 }, [
      F('Intestazione', { gap: 12, maxW: 640 }, [
        T('eyebrow', 'Etichetta', 'Servizi', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Tutto quello che serve, in un unico studio.', 'h2'),
      ]),
      F(
        'Schede',
        {
          layout: 'grid',
          cols: 3,
          gap: 20,
          align: 'stretch',
          anim: 'up',
          stagger: true,
          over: { tablet: { cols: 2 }, mobile: { cols: 1 } },
        },
        [
          F('Scheda', { gap: 14, padX: 28, padY: 28, radius: 'card', bg: 'surface', hover: 'lift' }, [
            T('n', 'Numero', '01', 'h2', { color: 'accent' }),
            T('h', 'Titolo', 'Progetto', 'h3'),
            T('p', 'Testo', 'Concept, disegni esecutivi e pratiche edilizie.', 'body', { color: 'muted' }),
          ]),
          F('Scheda', { gap: 14, padX: 28, padY: 28, radius: 'card', bg: 'surface', hover: 'lift' }, [
            T('n', 'Numero', '02', 'h2', { color: 'accent' }),
            T('h', 'Titolo', 'Interni', 'h3'),
            T('p', 'Testo', 'Arredi su misura, luci, materiali e colori.', 'body', { color: 'muted' }),
          ]),
          F('Scheda', { gap: 14, padX: 28, padY: 28, radius: 'card', bg: 'surface', hover: 'lift' }, [
            T('n', 'Numero', '03', 'h2', { color: 'accent' }),
            T('h', 'Titolo', 'Cantiere', 'h3'),
            T('p', 'Testo', 'Direzione lavori e un referente unico fino alla fine.', 'body', { color: 'muted' }),
          ]),
        ],
      ),
    ])
  if (key === 'features.alternating')
    return S('Servizi', { gap: 72 }, [
      F('Riga', { layout: 'row', gap: 56, align: 'center', over: { mobile: { layout: 'col', gap: 24 } } }, [
        I('image', 'Immagine', { ratio: '4/3', anim: 'left', animTrig: 'scroll' }),
        F('Testo', { gap: 14 }, [
          T('eyebrow', 'Etichetta', 'Interni', 'eyebrow', { color: 'muted' }),
          T('title', 'Titolo', 'Arredi pensati per come vivi.', 'h2'),
          T('p', 'Testo', 'Progettiamo ogni mobile su misura, partendo dalle tue abitudini quotidiane.', 'body', {
            color: 'muted',
          }),
        ]),
      ]),
      F('Riga', { layout: 'row', gap: 56, align: 'center', over: { mobile: { layout: 'col', gap: 24 } } }, [
        F('Testo', { gap: 14 }, [
          T('eyebrow', 'Etichetta', 'Ristrutturazioni', 'eyebrow', { color: 'muted' }),
          T('title', 'Titolo', 'Nuova vita agli edifici esistenti.', 'h2'),
          T(
            'p',
            'Testo',
            'Recuperiamo il carattere degli spazi migliorando comfort ed efficienza energetica.',
            'body',
            { color: 'muted' },
          ),
        ]),
        I('image', 'Immagine', { ratio: '4/3', anim: 'right', animTrig: 'scroll' }),
      ]),
    ])
  const step = (n: string, h: string, t: string) =>
    F('Passaggio', { gap: 10, padY: 20, topline: true }, [
      mono(n),
      T('h', 'Titolo', h, 'h3'),
      T('p', 'Testo', t, 'body', { color: 'muted' }),
    ])
  if (key === 'process.steps')
    return S('Processo', { gap: 48 }, [
      F('Intestazione', { gap: 12, maxW: 640 }, [
        T('eyebrow', 'Etichetta', 'Come lavoriamo', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Quattro passaggi, nessuna sorpresa.', 'h2'),
      ]),
      F(
        'Passaggi',
        {
          layout: 'grid',
          cols: 4,
          gap: 24,
          anim: 'up',
          stagger: true,
          over: { tablet: { cols: 2 }, mobile: { cols: 1, gap: 0 } },
        },
        [
          step('01', 'Sopralluogo', 'Visitiamo lo spazio e ascoltiamo cosa desideri.'),
          step('02', 'Concept', 'Ti mostriamo idee, materiali e una stima dei costi.'),
          step('03', 'Progetto', 'Disegni esecutivi, pratiche e scelta delle imprese.'),
          step('04', 'Cantiere', 'Seguiamo i lavori fino alla consegna delle chiavi.'),
        ],
      ),
    ])
  const year = (y: string, t: string) =>
    F('Anno', { layout: 'row', gap: 24, padY: 20, divider: true, align: 'start' }, [
      T('y', 'Anno', y, 'h3', { width: 'fixed', fixedW: 72, color: 'accent' }),
      T('p', 'Testo', t, 'body'),
    ])
  if (key === 'process.timeline')
    return S('Processo', { layout: 'row', gap: 64, over: { mobile: { layout: 'col', gap: 24 } } }, [
      F('Intestazione', { gap: 14, maxW: 360 }, [
        T('title', 'Titolo', 'La nostra storia', 'h2'),
        T('subtitle', 'Sottotitolo', 'Quindici anni di progetti, sempre a Milano.', 'body', { color: 'muted' }),
      ]),
      F('Cronologia', { gap: 0 }, [
        year('2010', 'Apriamo lo studio in un ex laboratorio sui Navigli.'),
        year('2015', 'Primo progetto pubblico: una biblioteca di quartiere.'),
        year('2019', 'Ci trasferiamo nella nuova sede di Brera.'),
        year('2024', 'Oltre cento progetti consegnati in Lombardia.'),
      ]),
    ])
  if (key === 'stats.big')
    return S('Numeri', { scheme: 'inverse' }, [
      F(
        'Numeri',
        { layout: 'grid', cols: 2, gap: 48, anim: 'up', stagger: true, over: { mobile: { cols: 1, gap: 24 } } },
        [
          F('Numero', { gap: 10, padY: 24, topline: true }, [
            T('v', 'Valore', '120+', 'display'),
            T('l', 'Descrizione', 'progetti consegnati in quindici anni', 'body', { color: 'muted' }),
          ]),
          F('Numero', { gap: 10, padY: 24, topline: true }, [
            T('v', 'Valore', '98%', 'display'),
            T('l', 'Descrizione', 'cantieri chiusi nei tempi previsti', 'body', { color: 'muted' }),
          ]),
        ],
      ),
    ])
  if (key === 'gallery.masonry')
    return S('Progetti', { gap: 32 }, [
      T('title', 'Titolo', 'Dettagli, materiali, luce', 'h2'),
      F(
        'Mosaico',
        {
          layout: 'grid',
          cols: 3,
          gap: 16,
          align: 'start',
          anim: 'zoom',
          stagger: true,
          over: { mobile: { cols: 2, gap: 10 } },
        },
        [
          I('image', 'Immagine', { ratio: '3/4', hover: 'zoomimg' }),
          I('image', 'Immagine', { ratio: '1/1', hover: 'zoomimg' }),
          I('image', 'Immagine', { ratio: '4/5', hover: 'zoomimg' }),
          I('image', 'Immagine', { ratio: '4/3', hover: 'zoomimg' }),
          I('image', 'Immagine', { ratio: '3/4', hover: 'zoomimg' }),
          I('image', 'Immagine', { ratio: '1/1', hover: 'zoomimg' }),
        ],
      ),
    ])
  const prow = (n: string, t: string, y: string) =>
    F(
      'Progetto',
      {
        layout: 'row',
        justify: 'between',
        align: 'center',
        gap: 16,
        padY: 22,
        divider: true,
        wrap: true,
        hover: 'dim',
      },
      [
        T('h', 'Titolo', n, 'h3', { width: 'hug' }),
        F('Dettagli', { layout: 'row', gap: 24, width: 'hug' }, [
          T('p', 'Dettagli', t, 'small', { color: 'muted', width: 'hug' }),
          T('y', 'Anno', y, 'small', { width: 'hug' }),
        ]),
      ],
    )
  if (key === 'gallery.list')
    return S('Progetti', { gap: 32 }, [
      T('title', 'Titolo', 'Indice dei progetti', 'h2'),
      F('Elenco', { gap: 0 }, [
        prow('Casa sul lago', 'Residenziale · Como', '2025'),
        prow('Loft Navigli', 'Interni · Milano', '2024'),
        prow('Uffici Brera', 'Ristrutturazione · Milano', '2023'),
        prow('Villa sui colli', 'Residenziale · Bergamo', '2022'),
      ]),
    ])
  if (key === 'media.video')
    return S('Video', { gap: 20 }, [
      I('image', 'Copertina del video', { ratio: '16/9', anim: 'blur', animTrig: 'scroll' }),
      F('Didascalia', { layout: 'row', justify: 'between', align: 'center', gap: 16, wrap: true }, [
        T('title', 'Titolo', 'Casa sul lago, il racconto del cantiere', 'h3', { width: 'hug' }),
        B('cta', 'Pulsante', 'Guarda il video', 'secondary'),
      ]),
    ])
  const qcard = (q: string, a: string) =>
    F('Recensione', { gap: 18, padX: 28, padY: 28, radius: 'card', bg: 'surface' }, [
      T('quote', 'Citazione', q, 'body'),
      T('author', 'Autore', a, 'small', { color: 'muted', weight: 600 }),
    ])
  if (key === 'testimonial.cards')
    return S('Testimonianze', { scheme: 'surface', gap: 40 }, [
      T('title', 'Titolo', 'Cosa dicono di noi', 'h2'),
      F(
        'Schede',
        {
          layout: 'grid',
          cols: 3,
          gap: 20,
          align: 'stretch',
          anim: 'up',
          stagger: true,
          over: { tablet: { cols: 1 }, mobile: { cols: 1 } },
        },
        [
          qcard('“Ogni scelta era spiegata, ogni costo chiaro. Il cantiere è stato sereno.”', 'Giulia e Marco · Como'),
          qcard('“Hanno trasformato un ufficio buio in un posto dove ci piace stare.”', 'Studio legale · Milano'),
          qcard('“Precisi, disponibili, attenti al budget fino all’ultimo giorno.”', 'Famiglia Rossi · Bergamo'),
        ],
      ),
    ])
  if (key === 'testimonial.split')
    return S(
      'Testimonianze',
      { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } },
      [
        I('image', 'Immagine', { ratio: '4/5' }),
        F('Testo', { gap: 20 }, [
          T(
            'quote',
            'Citazione',
            '“Hanno capito come volevamo vivere la casa prima ancora che lo sapessimo noi.”',
            'h2',
          ),
          T('author', 'Autore', 'Giulia e Marco · Casa sul lago', 'small', { color: 'muted' }),
        ]),
      ],
    )
  const award = (y: string, n: string, prj: string) =>
    F('Premio', { layout: 'row', gap: 24, padY: 18, divider: true, align: 'center', wrap: true }, [
      T('y', 'Anno', y, 'eyebrow', { width: 'fixed', fixedW: 64, color: 'accent' }),
      T('h', 'Titolo', n, 'h3'),
      T('p', 'Progetto', prj, 'small', { color: 'muted', width: 'hug' }),
    ])
  if (key === 'awards.list')
    return S('Premi e stampa', { gap: 32 }, [
      T('title', 'Titolo', 'Premi e pubblicazioni', 'h2'),
      F('Elenco', { gap: 0 }, [
        award('2025', 'Menzione · Concorso residenze sostenibili', 'Casa sul lago'),
        award('2024', 'Pubblicato su [rivista di architettura]', 'Loft Navigli'),
        award('2023', 'Finalista · Premio recupero edilizio', 'Uffici Brera'),
      ]),
    ])
  if (key === 'pricing.two')
    return S('Formule', { gap: 48 }, [
      F('Intestazione', { gap: 12, maxW: 620 }, [
        T('eyebrow', 'Etichetta', 'Formule', 'eyebrow', { color: 'muted' }),
        T('title', 'Titolo', 'Due modi di iniziare.', 'h2'),
      ]),
      F('Formule', { layout: 'grid', cols: 2, gap: 20, align: 'stretch', over: { mobile: { cols: 1 } } }, [
        plan('Consulenza', '450 €', 'Due ore con un architetto per valutare il tuo spazio.', false),
        plan('Progetto completo', 'Su misura', 'Dal concept alla consegna delle chiavi, con un unico referente.', true),
      ]),
    ])
  const tl = (n: string, r: string) =>
    F('Persona', { layout: 'row', justify: 'between', align: 'center', gap: 16, padY: 18, divider: true, wrap: true }, [
      T('h', 'Nome', n, 'h3', { width: 'hug' }),
      T('p', 'Ruolo', r, 'small', { color: 'muted', width: 'hug' }),
    ])
  if (key === 'team.list')
    return S('Team', { gap: 32 }, [
      T('title', 'Titolo', 'Le persone dello studio', 'h2'),
      F('Elenco', { gap: 0 }, [
        tl('Elena Moretti', 'Fondatrice, architetta'),
        tl('Luca Bianchi', 'Architetto'),
        tl('Sara Conti', 'Interior designer'),
        tl('Davide Ferri', 'Direzione lavori'),
      ]),
    ])
  const post = (d: string, t: string) =>
    F('Articolo', { gap: 12, hover: 'zoomimg' }, [
      I('image', 'Immagine', { ratio: '3/2' }),
      T('date', 'Data', d, 'small', { color: 'muted' }),
      T('h', 'Titolo', t, 'h3'),
    ])
  if (key === 'blog.grid')
    return S('Articoli', { gap: 40 }, [
      F('Intestazione', { layout: 'row', justify: 'between', align: 'end', gap: 24, wrap: true }, [
        T('title', 'Titolo', 'Dal nostro diario', 'h2', { width: 'hug' }),
        B('cta', 'Pulsante', 'Tutti gli articoli', 'ghost'),
      ]),
      F(
        'Griglia',
        {
          layout: 'grid',
          cols: 3,
          gap: 24,
          anim: 'up',
          stagger: true,
          over: { tablet: { cols: 2 }, mobile: { cols: 1 } },
        },
        [
          post('12 settembre 2026', 'Come scegliere i serramenti giusti'),
          post('28 agosto 2026', 'Cinque idee per un soggiorno più luminoso'),
          post('3 luglio 2026', 'Ristrutturare senza perdere il carattere'),
        ],
      ),
    ])
  const qa2 = (q: string, a: string) =>
    F('Domanda', { gap: 8 }, [T('h', 'Domanda', q, 'h3'), T('p', 'Risposta', a, 'body', { color: 'muted' })])
  if (key === 'faq.grid')
    return S('FAQ', { gap: 40 }, [
      T('title', 'Titolo', 'Domande frequenti', 'h2'),
      F('Griglia', { layout: 'grid', cols: 2, gap: 36, over: { mobile: { cols: 1, gap: 24 } } }, [
        qa2('Quanto dura un progetto?', 'In genere da tre a dodici mesi, cantiere escluso.'),
        qa2('Seguite anche il cantiere?', 'Sì, con la direzione lavori e un referente unico.'),
        qa2('Lavorate fuori Milano?', 'In Lombardia e, per progetti selezionati, nel resto d’Italia.'),
        qa2('Come si parte?', 'Con un sopralluogo e una conversazione, senza impegno.'),
      ]),
    ])
  if (key === 'contact.simple')
    return S('Contatti', { align: 'center', gap: 20, size: 'l' }, [
      T('eyebrow', 'Etichetta', 'Contatti', 'eyebrow', { color: 'muted', talign: 'center' }),
      T('title', 'Titolo', 'Raccontaci il tuo progetto.', 'h1', { talign: 'center', maxW: 760 }),
      T('subtitle', 'Sottotitolo', 'Rispondiamo entro due giorni lavorativi.', 'body', {
        color: 'muted',
        talign: 'center',
      }),
      F('Azioni', { layout: 'row', gap: 12, width: 'hug', justify: 'center', padY: 8 }, [
        B('cta', 'Pulsante', 'Scrivici una email', 'primary', { hover: 'lift' }),
      ]),
      T('address', 'Indirizzo', 'Via [indirizzo] · Milano', 'small', { color: 'muted', talign: 'center' }),
    ])
  const office = (c: string, a: string, h: string) =>
    F('Sede', { gap: 10 }, [
      I('image', 'Immagine', { ratio: '16/9' }),
      T('h', 'Città', c, 'h3'),
      T('a', 'Indirizzo', a, 'small', { color: 'muted' }),
      T('o', 'Orari', h, 'small'),
    ])
  if (key === 'contact.locations')
    return S('Contatti', { gap: 40 }, [
      T('title', 'Titolo', 'Dove siamo', 'h2'),
      F('Sedi', { layout: 'grid', cols: 2, gap: 24, over: { mobile: { cols: 1 } } }, [
        office('Milano', 'Via [indirizzo], Brera', 'Lunedì–venerdì, 9–18'),
        office('Como', 'Via [indirizzo], centro', 'Su appuntamento'),
      ]),
    ])
  if (key === 'cta.split')
    return S(
      'Invito',
      { scheme: 'surface', layout: 'row', gap: 56, align: 'center', over: { mobile: { layout: 'col', gap: 28 } } },
      [
        F('Testo', { gap: 16 }, [
          T('title', 'Titolo', 'Visita lo studio.', 'h2'),
          T(
            'subtitle',
            'Sottotitolo',
            'Ti mostriamo materiali, campioni e progetti realizzati, davanti a un caffè.',
            'body',
            { color: 'muted' },
          ),
          F('Azioni', { layout: 'row', gap: 12, width: 'hug', padY: 8 }, [
            B('cta', 'Pulsante', 'Prenota una visita', 'primary', { hover: 'lift' }),
          ]),
        ]),
        I('image', 'Immagine', { ratio: '4/3' }),
      ],
    )
  if (key === 'cta.newsletter')
    return S('Invito', { align: 'center', gap: 18, size: 'm' }, [
      T('title', 'Titolo', 'Ricevi i nuovi progetti', 'h2', { talign: 'center' }),
      T('subtitle', 'Sottotitolo', 'Una email al mese, niente di più.', 'body', { color: 'muted', talign: 'center' }),
      F('Modulo', { layout: 'row', gap: 10, width: 'hug', wrap: true, justify: 'center', padY: 8 }, [
        T('fi', 'Campo', 'La tua email', 'small', {
          color: 'muted',
          bg: 'surface',
          padX: 18,
          padY: 14,
          radius: 'btn',
          width: 'fixed',
          fixedW: 280,
        }),
        B('cta', 'Pulsante', 'Iscriviti', 'primary'),
      ]),
    ])
  if (key === 'divider.statement')
    return S('Separatore', { align: 'center', size: 'l' }, [
      T('title', 'Frase', 'Ogni progetto parte da una domanda: come vuoi vivere questo spazio?', 'h1', {
        talign: 'center',
        maxW: 940,
        anim: 'blur',
        animTrig: 'scroll',
      }),
    ])
  if (key === 'divider.line') return S('Separatore', { size: 's' }, [F('Linea', { padY: 0, divider: true }, [])])
  if (key === 'footer.big')
    return S('Footer', { scheme: 'inverse', gap: 40, size: 'm' }, [
      T('logo', 'Logo', brand, 'display'),
      F('Riga', { layout: 'row', justify: 'between', align: 'center', gap: 24, wrap: true, padY: 20, topline: true }, [
        T('subtitle', 'Sottotitolo', 'Studio di architettura · Milano', 'small', { color: 'muted', width: 'hug' }),
        F('Link', { layout: 'row', gap: 24, width: 'hug' }, [
          T('l1', 'Link', 'Instagram', 'small', { width: 'hug' }),
          T('l2', 'Link', 'LinkedIn', 'small', { width: 'hug' }),
          T('l3', 'Link', 'Privacy', 'small', { width: 'hug' }),
        ]),
      ]),
    ])
  return buildMore(key, brand, S) ?? S('Sezione', {}, [T('title', 'Titolo', 'Nuova sezione', 'h2')])
}

// ---------- more sections ----------

/** Variants added to the prototype's library: [category, variant, label, keywords]. */
const MORE: [string, string, string, string][] = [
  ['nav', 'split', 'Logo al centro', 'menu centrato'],
  ['nav', 'pill', 'Barra sospesa', 'menu arrotondato'],
  ['hero', 'reverse', 'Immagine a sinistra', 'apertura'],
  ['hero', 'minimal', 'Solo testo', 'apertura manifesto'],
  ['hero', 'stats', 'Con numeri', 'apertura statistiche'],
  ['hero', 'mosaic', 'Con mosaico', 'apertura foto galleria'],
  ['hero', 'accent', 'Colore di accento', 'apertura'],
  ['hero', 'form', 'Con iscrizione', 'apertura email newsletter'],
  ['banner', 'cta', 'Con pulsante', 'avviso promozione'],
  ['banner', 'inverse', 'Scuro', 'avviso'],
  ['logos', 'inverse', 'Su fondo scuro', 'clienti partner'],
  ['logos', 'quote', 'Con citazione', 'clienti recensione'],
  ['logos', 'marquee', 'Nastro di parole', 'nastro scorrevole marquee scorre infinito parole servizi'],
  ['logos', 'marquee-logos', 'Nastro di loghi', 'nastro scorrevole marquee scorre infinito clienti partner'],
  ['about', 'values', 'Valori', 'principi studio'],
  ['about', 'mission', 'Manifesto', 'missione frase'],
  ['about', 'stats', 'Con numeri', 'studio storia statistiche'],
  ['features', 'icons', 'Quattro colonne', 'servizi vantaggi'],
  ['features', 'bento', 'Bento', 'griglia schede foto'],
  ['features', 'checklist', 'Con spunte', 'elenco vantaggi inclusi'],
  ['features', 'list', 'Elenco a due colonne', 'servizi'],
  ['process', 'cards', 'Schede numerate', 'fasi metodo'],
  ['process', 'image', 'Con immagine', 'fasi metodo foto'],
  ['stats', 'cards', 'Schede', 'statistiche'],
  ['stats', 'four', 'Quattro colonne', 'statistiche'],
  ['stats', 'image', 'Con immagine', 'statistiche foto'],
  ['gallery', 'wide', 'A tutta larghezza', 'foto portfolio'],
  ['gallery', 'row', 'Fila di quattro', 'portfolio foto'],
  ['gallery', 'captions', 'Con didascalie', 'portfolio storie'],
  ['gallery', 'pair', 'Prima e dopo', 'confronto ristrutturazione'],
  ['media', 'split', 'Video e testo', 'filmato racconto'],
  ['media', 'two', 'Due video', 'filmati'],
  ['testimonial', 'big', 'Grande su fondo scuro', 'recensione citazione'],
  ['testimonial', 'grid', 'Griglia di sei', 'recensioni'],
  ['testimonial', 'logo', 'Con logo del cliente', 'recensione azienda'],
  ['awards', 'grid', 'Griglia', 'premi riconoscimenti'],
  ['awards', 'press', 'Rassegna stampa', 'pubblicazioni giornali'],
  ['pricing', 'one', 'Formula unica', 'prezzo piano'],
  ['pricing', 'list', 'Listino', 'prezzi tariffe'],
  ['team', 'cards', 'Schede con biografia', 'persone'],
  ['team', 'founder', 'Fondatrice', 'persona ritratto'],
  ['blog', 'list', 'Elenco', 'articoli notizie'],
  ['blog', 'featured', 'In evidenza', 'articoli notizie copertina'],
  ['faq', 'center', 'Centrate', 'domande'],
  ['faq', 'split', 'Con contatto', 'domande aiuto'],
  ['contact', 'split', 'Con immagine', 'contatti foto'],
  ['contact', 'hours', 'Orari e recapiti', 'contatti apertura'],
  ['contact', 'cards', 'Tre modi', 'contatti telefono email'],
  ['cta', 'two', 'Due pulsanti', 'call to action'],
  ['cta', 'photo', 'Con foto di sfondo', 'call to action'],
  ['cta', 'card', 'Scheda centrale', 'call to action'],
  ['divider', 'space', 'Spazio', 'vuoto respiro'],
  ['divider', 'quote', 'Citazione', 'frase autore'],
  ['footer', 'centered', 'Centrato', 'piè di pagina'],
  ['footer', 'newsletter', 'Con iscrizione', 'piè di pagina email'],
  ['events', 'list', 'Elenco di date', 'eventi calendario incontri'],
  ['events', 'cards', 'Schede', 'eventi workshop'],
  ['products', 'grid', 'Griglia', 'prodotti negozio shop'],
  ['products', 'feature', 'In evidenza', 'prodotto negozio'],
  ['compare', 'table', 'Tabella', 'confronto formule'],
  ['hours', 'week', 'Settimana', 'orari apertura'],
]

const NEW_CATEGORIES: Record<string, string> = {
  events: 'Eventi',
  products: 'Prodotti',
  compare: 'Confronto',
  hours: 'Orari',
}

for (const [cat, v, label, keywords] of MORE) {
  let c = LIBRARY.find((x) => x.key === cat)
  if (!c) {
    c = { key: cat, label: NEW_CATEGORIES[cat] ?? cat, variants: [] }
    // New categories go before the closing ones.
    const footer = LIBRARY.findIndex((x) => x.key === 'divider')
    LIBRARY.splice(footer < 0 ? LIBRARY.length : footer, 0, c)
  }
  c.variants.push({ key: `${cat}.${v}`, label, keywords })
}

function buildMore(key: string, brand: string, S: (n: string, p: P, k: PageNode[]) => PageNode): PageNode | null {
  const eyebrow = (t: string, p: P = {}) => T('eyebrow', 'Etichetta', t, 'eyebrow', { color: 'muted', ...p })
  const head = (e: string, t: string, p: P = {}) =>
    F('Intestazione', { gap: 12, maxW: 640, ...p }, [
      eyebrow(e, { talign: p.align === 'center' ? 'center' : 'left' }),
      T('title', 'Titolo', t, 'h2', { talign: p.align === 'center' ? 'center' : 'left' }),
    ])
  const muted = (t: string, p: P = {}) => T('p', 'Testo', t, 'body', { color: 'muted', ...p })
  const actions = (p: P, ...buttons: PageNode[]) =>
    F('Azioni', { layout: 'row', gap: 12, width: 'hug', wrap: true, padY: 8, ...p }, buttons)
  const links = (...l: string[]) =>
    F(
      'Link',
      { layout: 'row', gap: 28, width: 'hug', align: 'center', over: { mobile: { hidden: true } } },
      l.map((t) => T('link', 'Link', t, 'small', { width: 'hug' })),
    )
  const logo = () => T('logo', 'Logo', brand, 'logo', { width: 'hug' })
  const logoTile = (p: P = {}) =>
    I('logo', 'Logo', { ratio: '3/1', width: 'fixed', fixedW: 120, tone: 3, radius: 4, ...p })
  const stat = (v: string, l: string, p: P = {}) => F('Numero', { gap: 6, ...p }, [T('v', 'Valore', v, 'h1'), muted(l)])
  const quote = (q: string, a: string, p: P = {}) =>
    F('Recensione', { gap: 16, padX: 26, padY: 26, radius: 'card', bg: 'surface', ...p }, [
      T('quote', 'Citazione', q, 'body'),
      T('author', 'Autore', a, 'small', { color: 'muted', weight: 600 }),
    ])

  switch (key) {
    case 'nav.split':
      return S(
        'Navigazione',
        { layout: 'grid', cols: 3, align: 'center', size: 'xs', gap: 16, divider: true, over: { mobile: { cols: 2 } } },
        [
          links('Progetti', 'Studio'),
          F('Marchio', { align: 'center', over: { mobile: { align: 'start' } } }, [logo()]),
          F('Azioni', { layout: 'row', justify: 'end', align: 'center' }, [
            B('cta', 'Pulsante', 'Contatti', 'ghost', { padY: 10, padX: 18 }),
          ]),
        ],
      )
    case 'nav.pill':
      return S('Navigazione', { size: 'xs', gap: 0 }, [
        F(
          'Barra',
          {
            layout: 'row',
            justify: 'between',
            align: 'center',
            gap: 16,
            padX: 20,
            padY: 10,
            radius: 'btn',
            bg: 'surface',
            shadow: 'sm',
          },
          [
            logo(),
            links('Progetti', 'Studio', 'Diario'),
            B('cta', 'Pulsante', 'Parliamone', 'primary', { padY: 10, padX: 18 }),
          ],
        ),
      ])
    case 'hero.reverse':
      return S(
        'Hero',
        { layout: 'row', gap: 64, align: 'center', size: 'l', over: { mobile: { layout: 'col', gap: 40 } } },
        [
          I('image', 'Immagine', { ratio: '4/5', tone: 2, anim: 'left' }),
          F('Testo', { gap: 22, anim: 'up', stagger: true }, [
            eyebrow('Architettura e interni'),
            T('title', 'Titolo', 'Case su misura, costruite con calma.', 'display'),
            muted('Ogni progetto nasce da un ascolto lungo e si chiude con una casa che ti somiglia.', { maxW: 460 }),
            actions({}, B('cta', 'Pulsante', 'Prenota un incontro', 'primary')),
          ]),
        ],
      )
    case 'hero.minimal':
      return S('Hero', { size: 'l', gap: 28 }, [
        eyebrow('Studio di architettura'),
        T('title', 'Titolo', 'Progettiamo spazi in cui si vive meglio, non solo più belli.', 'display', {
          maxW: 1080,
          anim: 'blur',
        }),
        F('Riga', { layout: 'row', justify: 'between', align: 'end', gap: 24, wrap: true, topline: true, padY: 24 }, [
          muted('Milano · Como · dal 2010', { width: 'hug' }),
          B('cta', 'Pulsante', 'Guarda i progetti', 'ghost'),
        ]),
      ])
    case 'hero.stats':
      return S('Hero', { gap: 56, size: 'l' }, [
        F('Testo', { gap: 22, maxW: 860, anim: 'up', stagger: true }, [
          eyebrow('Studio di architettura · Milano'),
          T('title', 'Titolo', 'Quindici anni di case luminose.', 'display'),
          muted('Dal progetto al cantiere, con un unico referente.', { maxW: 520 }),
        ]),
        F(
          'Numeri',
          {
            layout: 'grid',
            cols: 4,
            gap: 24,
            topline: true,
            padY: 28,
            over: { tablet: { cols: 2 }, mobile: { cols: 2 } },
          },
          [
            stat('15', 'anni di attività'),
            stat('120+', 'progetti consegnati'),
            stat('9', 'persone nello studio'),
            stat('98%', 'cantieri nei tempi'),
          ],
        ),
      ])
    case 'hero.mosaic':
      return S('Hero', { gap: 48, size: 'l' }, [
        F('Testo', { gap: 20, align: 'center', maxW: 820 }, [
          eyebrow('Portfolio', { talign: 'center' }),
          T('title', 'Titolo', 'Luce, materia, proporzione.', 'display', { talign: 'center' }),
        ]),
        F(
          'Mosaico',
          { layout: 'grid', cols: 3, gap: 16, align: 'end', anim: 'up', stagger: true, over: { mobile: { cols: 1 } } },
          [
            I('image', 'Immagine', { ratio: '3/4', tone: 1 }),
            I('image', 'Immagine', { ratio: '4/5', tone: 2 }),
            I('image', 'Immagine', { ratio: '3/4', tone: 3 }),
          ],
        ),
      ])
    case 'hero.accent':
      return S('Hero', { scheme: 'accent', size: 'l', gap: 24 }, [
        T('title', 'Titolo', 'Una casa nuova, senza sorprese.', 'display', { maxW: 900, anim: 'up' }),
        T('subtitle', 'Sottotitolo', 'Costi chiari, tempi certi, un solo interlocutore.', 'body', {
          color: 'muted',
          maxW: 520,
        }),
        actions({}, B('cta', 'Pulsante', 'Chiedi un preventivo', 'secondary')),
      ])
    case 'hero.form':
      return S(
        'Hero',
        { layout: 'row', gap: 64, align: 'center', size: 'l', over: { mobile: { layout: 'col', gap: 32 } } },
        [
          F('Testo', { gap: 20 }, [
            eyebrow('Guida gratuita'),
            T('title', 'Titolo', 'Ristrutturare casa, passo dopo passo.', 'h1'),
            muted('Una guida di venti pagine con costi, tempi e permessi. Te la mandiamo per email.'),
          ]),
          F('Modulo', { gap: 12, padX: 28, padY: 28, radius: 'card', scheme: 'surface', maxW: 440 }, [
            T('fl', 'Etichetta', 'La tua email', 'small', { weight: 500 }),
            T('fi', 'Campo', 'nome@example.com', 'small', {
              color: 'muted',
              bg: 'bg',
              padX: 14,
              padY: 12,
              radius: 8,
              border: true,
            }),
            B('cta', 'Pulsante', 'Ricevi la guida', 'primary', { width: 'fill' }),
            T('note', 'Nota', 'Niente spam: una email e basta.', 'small', { color: 'muted' }),
          ]),
        ],
      )
    case 'banner.cta':
      return S(
        'Annuncio',
        { scheme: 'surface', layout: 'row', justify: 'center', align: 'center', gap: 16, wrap: true, size: 'xs' },
        [
          T('text', 'Testo', 'Porte aperte in studio sabato 14 novembre.', 'small', { width: 'hug' }),
          B('cta', 'Pulsante', 'Prenota', 'primary', { padY: 8, padX: 16 }),
        ],
      )
    case 'banner.inverse':
      return S(
        'Annuncio',
        { scheme: 'inverse', layout: 'row', justify: 'center', align: 'center', gap: 14, wrap: true, size: 'xs' },
        [
          T('text', 'Testo', 'Il nostro progetto per la biblioteca di quartiere ha vinto un premio.', 'small', {
            width: 'hug',
          }),
          T('link', 'Link', 'Leggi', 'small', { width: 'hug', weight: 600, runs: [{ t: 'Leggi', href: '/diario' }] }),
        ],
      )
    case 'logos.inverse':
      return S('Loghi', { scheme: 'inverse', align: 'center', gap: 28, size: 's' }, [
        T('label', 'Etichetta', 'Ci hanno scelto', 'eyebrow', { color: 'muted', talign: 'center' }),
        F(
          'Loghi',
          { layout: 'row', wrap: true, gap: 40, justify: 'center', align: 'center' },
          [1, 2, 3, 4, 5, 6].map(() => logoTile({ tone: 2 })),
        ),
      ])
    case 'logos.marquee': {
      // Big words that scroll without end; the stars are separate texts, easy to change or remove.
      const word = (t: string, italic = false) =>
        T('word', 'Parola', t, 'display', { width: 'hug', fontSize: '8vw', leading: 1, italic })
      const star = () => T('star', 'Separatore', '✦', 'h2', { width: 'hug', color: 'accent', fontSize: '3vw' })
      return S('Nastro di parole', { size: 's', gap: 0, topline: true, divider: true, overflow: 'hidden' }, [
        F('Nastro', { layout: 'row', gap: '4vw', align: 'center', marquee: { duration: 40, fade: 12 } }, [
          word('Architettura'),
          star(),
          word('Interni', true),
          star(),
          word('Restauro'),
          star(),
          word('Paesaggio', true),
          star(),
        ]),
      ])
    }
    case 'logos.marquee-logos':
      return S('Nastro di loghi', { size: 's', gap: 24, align: 'center', overflow: 'hidden' }, [
        T('label', 'Etichetta', 'Hanno lavorato con noi', 'eyebrow', { color: 'muted', talign: 'center' }),
        F(
          'Nastro',
          { layout: 'row', gap: 64, align: 'center', marquee: { duration: 30, fade: 15 } },
          [1, 2, 3, 4, 5, 6].map(() => logoTile({ tone: 2 })),
        ),
      ])
    case 'logos.quote':
      return S('Loghi', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
        F('Citazione', { gap: 14 }, [
          T('quote', 'Citazione', '“Il partner giusto per i nostri uffici: precisi e attenti.”', 'h3'),
          T('author', 'Autore', 'Responsabile sedi · Studio legale', 'small', { color: 'muted' }),
        ]),
        F(
          'Loghi',
          { layout: 'grid', cols: 3, gap: 16 },
          [1, 2, 3, 4, 5, 6].map(() => logoTile({ width: 'fill' })),
        ),
      ])
    case 'about.values': {
      const value = (n: string, h: string, t: string) =>
        F('Valore', { gap: 10, padY: 20, topline: true }, [
          T('n', 'Numero', n, 'eyebrow', { color: 'accent' }),
          T('h', 'Titolo', h, 'h3'),
          muted(t),
        ])
      return S('Chi siamo', { gap: 48 }, [
        head('I nostri principi', 'Tre cose in cui crediamo.'),
        F(
          'Valori',
          { layout: 'grid', cols: 3, gap: 32, anim: 'up', stagger: true, over: { mobile: { cols: 1, gap: 0 } } },
          [
            value('01', 'Ascolto', 'Il progetto migliore nasce dalle domande giuste.'),
            value('02', 'Onestà', 'Costi e tempi chiari, scritti fin dall’inizio.'),
            value('03', 'Durata', 'Materiali che invecchiano bene, come le persone che li abitano.'),
          ],
        ),
      ])
    }
    case 'about.mission':
      return S('Chi siamo', { scheme: 'surface', size: 'l', gap: 28 }, [
        eyebrow('Il nostro manifesto'),
        T(
          'title',
          'Frase',
          'Non disegniamo case da rivista. Disegniamo case da vivere, ogni giorno, per molti anni.',
          'h1',
          { maxW: 1000, anim: 'blur', animTrig: 'scroll' },
        ),
        T('sign', 'Firma', `— ${brand}`, 'small', { color: 'muted' }),
      ])
    case 'about.stats':
      return S('Chi siamo', { layout: 'row', gap: 64, over: { mobile: { layout: 'col', gap: 32 } } }, [
        F('Testo', { gap: 18 }, [
          eyebrow('Lo studio'),
          T('title', 'Titolo', 'Piccoli abbastanza da seguirti, grandi abbastanza da costruire.', 'h2'),
          muted(
            'Architetti, interior designer e un ufficio tecnico interno: tutto quello che serve sotto lo stesso tetto.',
          ),
        ]),
        F('Numeri', { layout: 'grid', cols: 2, gap: 28 }, [
          stat('2010', 'anno di fondazione'),
          stat('9', 'persone'),
          stat('120+', 'progetti'),
          stat('3', 'premi'),
        ]),
      ])
    case 'features.icons': {
      const item = (n: string, h: string, t: string) =>
        F('Servizio', { gap: 10 }, [
          T('n', 'Numero', n, 'h3', { color: 'accent' }),
          T('h', 'Titolo', h, 'h3'),
          muted(t),
        ])
      return S('Servizi', { gap: 48 }, [
        head('Servizi', 'Tutto quello che serve per costruire.'),
        F(
          'Griglia',
          {
            layout: 'grid',
            cols: 4,
            gap: 32,
            anim: 'up',
            stagger: true,
            over: { tablet: { cols: 2 }, mobile: { cols: 1 } },
          },
          [
            item('◦', 'Progetto', 'Concept e disegni esecutivi.'),
            item('◦', 'Interni', 'Arredi su misura e luci.'),
            item('◦', 'Pratiche', 'Permessi e documenti.'),
            item('◦', 'Cantiere', 'Direzione lavori fino alla fine.'),
          ],
        ),
      ])
    }
    case 'features.bento':
      return S('Servizi', { gap: 40 }, [
        head('Perché noi', 'Un solo studio, ogni dettaglio.'),
        F('Bento', { layout: 'grid', cols: 3, gap: 16, align: 'stretch', over: { mobile: { cols: 1 } } }, [
          F('Scheda grande', { gap: 14, padX: 28, padY: 28, radius: 'card', scheme: 'inverse', justify: 'end' }, [
            T('h', 'Titolo', 'Un referente unico', 'h2'),
            muted('Dal primo schizzo alle chiavi parli sempre con la stessa persona.'),
          ]),
          I('image', 'Immagine', { ratio: '1/1', tone: 2 }),
          F('Scheda', { gap: 10, padX: 24, padY: 24, radius: 'card', bg: 'surface' }, [
            T('v', 'Valore', '98%', 'h1', { color: 'accent' }),
            muted('cantieri chiusi nei tempi'),
          ]),
          I('image', 'Immagine', { ratio: '1/1', tone: 1 }),
          F('Scheda', { gap: 10, padX: 24, padY: 24, radius: 'card', bg: 'surface' }, [
            T('h', 'Titolo', 'Costi chiari', 'h3'),
            muted('Preventivo dettagliato prima di iniziare.'),
          ]),
          F('Scheda', { gap: 10, padX: 24, padY: 24, radius: 'card', scheme: 'accent' }, [
            T('h', 'Titolo', 'Materiali onesti', 'h3'),
            muted('Legno, pietra, calce: scelti per durare.'),
          ]),
        ]),
      ])
    case 'features.checklist': {
      const check = (t: string) => T('c', 'Voce', `✓  ${t}`, 'body', { padY: 14, divider: true })
      return S('Servizi', { layout: 'row', gap: 64, over: { mobile: { layout: 'col', gap: 28 } } }, [
        head('Cosa è incluso', 'Nel progetto completo trovi tutto questo.', { maxW: 420 }),
        F('Elenco', { gap: 0 }, [
          check('Rilievo e sopralluoghi'),
          check('Concept e tre proposte'),
          check('Disegni esecutivi e computo'),
          check('Pratiche edilizie'),
          check('Direzione lavori'),
          check('Consegna e collaudo'),
        ]),
      ])
    }
    case 'features.list': {
      const row = (h: string, t: string) =>
        F('Voce', { gap: 6, padY: 20, divider: true }, [T('h', 'Titolo', h, 'h3'), muted(t)])
      return S('Servizi', { gap: 40 }, [
        head('Servizi', 'Cosa facciamo.'),
        F('Elenco', { layout: 'grid', cols: 2, gap: 40, over: { mobile: { cols: 1, gap: 0 } } }, [
          row('Nuove costruzioni', 'Case unifamiliari e piccoli condomini.'),
          row('Ristrutturazioni', 'Recupero e riqualificazione energetica.'),
          row('Interni', 'Progetto d’arredo, luci e materiali.'),
          row('Consulenze', 'Valutazioni prima dell’acquisto.'),
        ]),
      ])
    }
    case 'process.cards': {
      const card = (n: string, h: string, t: string) =>
        F('Fase', { gap: 12, padX: 24, padY: 24, radius: 'card', border: true, hover: 'lift' }, [
          T('n', 'Numero', n, 'h1', { color: 'accent' }),
          T('h', 'Titolo', h, 'h3'),
          muted(t),
        ])
      return S('Processo', { gap: 44 }, [
        head('Metodo', 'Come lavoriamo.'),
        F(
          'Fasi',
          {
            layout: 'grid',
            cols: 3,
            gap: 20,
            align: 'stretch',
            anim: 'up',
            stagger: true,
            over: { mobile: { cols: 1 } },
          },
          [
            card('1', 'Incontro', 'Conosciamo te e lo spazio.'),
            card('2', 'Progetto', 'Disegniamo e stimiamo i costi.'),
            card('3', 'Cantiere', 'Costruiamo, con te a bordo.'),
          ],
        ),
      ])
    }
    case 'process.image': {
      const s = (n: string, h: string, t: string) =>
        F('Fase', { layout: 'row', gap: 18, padY: 18, divider: true }, [
          T('n', 'Numero', n, 'eyebrow', { color: 'accent', width: 'fixed', fixedW: 32 }),
          F('Testo', { gap: 4 }, [T('h', 'Titolo', h, 'h3'), muted(t)]),
        ])
      return S('Processo', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
        F('Testo', { gap: 20 }, [
          head('Metodo', 'Dal sopralluogo alle chiavi.'),
          F('Fasi', { gap: 0 }, [
            s('01', 'Sopralluogo', 'Misuriamo e ascoltiamo.'),
            s('02', 'Progetto', 'Idee, materiali, costi.'),
            s('03', 'Cantiere', 'Lavori seguiti ogni settimana.'),
            s('04', 'Consegna', 'Le chiavi e un brindisi.'),
          ]),
        ]),
        I('image', 'Immagine', { ratio: '4/5', tone: 2 }),
      ])
    }
    case 'stats.cards':
      return S('Numeri', { gap: 40 }, [
        head('In numeri', 'Quindici anni di lavoro.'),
        F('Numeri', { layout: 'grid', cols: 3, gap: 20, anim: 'up', stagger: true, over: { mobile: { cols: 1 } } }, [
          stat('120+', 'progetti consegnati', { padX: 26, padY: 26, radius: 'card', bg: 'surface' }),
          stat('15', 'anni di attività', { padX: 26, padY: 26, radius: 'card', bg: 'surface' }),
          stat('3', 'premi di architettura', { padX: 26, padY: 26, radius: 'card', bg: 'surface' }),
        ]),
      ])
    case 'stats.four':
      return S('Numeri', { scheme: 'inverse', size: 's' }, [
        F('Numeri', { layout: 'grid', cols: 4, gap: 24, over: { tablet: { cols: 2 }, mobile: { cols: 2 } } }, [
          stat('15', 'anni'),
          stat('120+', 'progetti'),
          stat('9', 'persone'),
          stat('3', 'premi'),
        ]),
      ])
    case 'stats.image':
      return S('Numeri', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
        I('image', 'Immagine', { ratio: '4/3', tone: 1 }),
        F('Numeri', { gap: 28 }, [
          stat('120+', 'progetti consegnati in Lombardia', { padY: 18, divider: true }),
          stat('98%', 'cantieri chiusi nei tempi previsti', { padY: 18, divider: true }),
          stat('4,9', 'valutazione media dei clienti'),
        ]),
      ])
    case 'gallery.wide':
      return S('Progetti', { gap: 16, size: 's' }, [
        I('image', 'Immagine', {
          ratio: '21/9',
          tone: 1,
          radius: 0,
          anim: 'zoomout',
          animTrig: 'scroll',
          over: { mobile: { ratio: '4/3' } },
        }),
        F('Didascalia', { layout: 'row', justify: 'between', gap: 16, wrap: true }, [
          T('h', 'Titolo', 'Casa sul lago, 2025', 'h3', { width: 'hug' }),
          T('p', 'Dettagli', 'Residenziale · Como', 'small', { color: 'muted', width: 'hug' }),
        ]),
      ])
    case 'gallery.row':
      return S('Progetti', { gap: 32 }, [
        T('title', 'Titolo', 'Dettagli', 'h2'),
        F(
          'Fila',
          { layout: 'grid', cols: 4, gap: 12, anim: 'up', stagger: true, over: { mobile: { cols: 2 } } },
          [1, 2, 3, 1].map((t) => I('image', 'Immagine', { ratio: '3/4', tone: t as Tone, hover: 'zoomimg' })),
        ),
      ])
    case 'gallery.captions': {
      const story = (h: string, t: string, tone: Tone) =>
        F('Progetto', { gap: 14, hover: 'zoomimg' }, [
          I('image', 'Immagine', { ratio: '3/2', tone }),
          T('h', 'Titolo', h, 'h2'),
          muted(t),
        ])
      return S('Progetti', { gap: 48 }, [
        head('Progetti', 'Storie di case.'),
        F('Griglia', { layout: 'grid', cols: 2, gap: 40, over: { mobile: { cols: 1 } } }, [
          story('Casa sul lago', 'Una villa degli anni Sessanta riaperta verso l’acqua.', 1),
          story('Loft Navigli', 'Un ex laboratorio diventato casa e studio.', 2),
        ]),
      ])
    }
    case 'gallery.pair':
      return S('Progetti', { gap: 32 }, [
        head('Prima e dopo', 'Una ristrutturazione in due immagini.'),
        F('Coppia', { layout: 'grid', cols: 2, gap: 16, over: { mobile: { cols: 1 } } }, [
          F('Prima', { gap: 10 }, [
            I('image', 'Prima', { ratio: '4/3', tone: 3 }),
            T('l', 'Etichetta', 'Prima', 'eyebrow', { color: 'muted' }),
          ]),
          F('Dopo', { gap: 10 }, [
            I('image', 'Dopo', { ratio: '4/3', tone: 1 }),
            T('l', 'Etichetta', 'Dopo', 'eyebrow', { color: 'accent' }),
          ]),
        ]),
      ])
    case 'media.split':
      return S('Video', { layout: 'row', gap: 56, align: 'center', over: { mobile: { layout: 'col', gap: 28 } } }, [
        I('image', 'Copertina del video', { ratio: '16/9', tone: 2 }),
        F('Testo', { gap: 16 }, [
          eyebrow('Video'),
          T('title', 'Titolo', 'Dentro il cantiere', 'h2'),
          muted('Tre minuti per vedere come lavoriamo, dal primo muro all’ultima finitura.'),
          actions({}, B('cta', 'Pulsante', 'Guarda il video', 'primary')),
        ]),
      ])
    case 'media.two':
      return S('Video', { gap: 32 }, [
        T('title', 'Titolo', 'Racconti', 'h2'),
        F('Video', { layout: 'grid', cols: 2, gap: 20, over: { mobile: { cols: 1 } } }, [
          F('Video', { gap: 10 }, [
            I('image', 'Copertina', { ratio: '16/9', tone: 1 }),
            T('h', 'Titolo', 'Casa sul lago', 'h3'),
          ]),
          F('Video', { gap: 10 }, [
            I('image', 'Copertina', { ratio: '16/9', tone: 2 }),
            T('h', 'Titolo', 'Loft Navigli', 'h3'),
          ]),
        ]),
      ])
    case 'testimonial.big':
      return S('Testimonianze', { scheme: 'inverse', size: 'l', gap: 32 }, [
        T(
          'quote',
          'Citazione',
          '“Abbiamo comprato una casa vecchia e buia. Ci hanno restituito un posto pieno di luce, nei tempi promessi.”',
          'h1',
          { maxW: 1040, anim: 'blur', animTrig: 'scroll' },
        ),
        F('Autore', { layout: 'row', gap: 14, align: 'center' }, [
          I('avatar', 'Ritratto', { ratio: '1/1', width: 'fixed', fixedW: 48, radius: 999, tone: 2 }),
          T('author', 'Autore', 'Giulia e Marco · Como', 'small', { color: 'muted', width: 'hug' }),
        ]),
      ])
    case 'testimonial.grid':
      return S('Testimonianze', { gap: 40 }, [
        head('Recensioni', 'Cosa dicono i clienti.'),
        F(
          'Griglia',
          {
            layout: 'grid',
            cols: 3,
            gap: 16,
            align: 'stretch',
            anim: 'up',
            stagger: true,
            over: { tablet: { cols: 2 }, mobile: { cols: 1 } },
          },
          [
            quote('“Precisi e disponibili.”', 'Famiglia Rossi'),
            quote('“Cantiere sereno, nessuna sorpresa.”', 'Paolo B.'),
            quote('“Hanno capito subito cosa volevamo.”', 'Giulia e Marco'),
            quote('“Un ufficio dove ci piace stare.”', 'Studio legale'),
            quote('“Costi rispettati fino all’ultimo euro.”', 'Anna T.'),
            quote('“Li richiameremo per la casa al mare.”', 'Luca e Sara'),
          ],
        ),
      ])
    case 'testimonial.logo':
      return S('Testimonianze', { align: 'center', gap: 24, size: 'l' }, [
        logoTile({ fixedW: 140 }),
        T(
          'quote',
          'Citazione',
          '“Hanno trasformato tre piani di uffici senza fermare il nostro lavoro un solo giorno.”',
          'h2',
          { talign: 'center', maxW: 900 },
        ),
        T('author', 'Autore', 'Direttrice operativa · Gruppo editoriale', 'small', {
          color: 'muted',
          talign: 'center',
        }),
      ])
    case 'awards.grid': {
      const award = (y: string, n: string) =>
        F('Premio', { gap: 8, padX: 22, padY: 22, radius: 'card', border: true }, [
          T('y', 'Anno', y, 'eyebrow', { color: 'accent' }),
          T('h', 'Titolo', n, 'h3'),
        ])
      return S('Premi e stampa', { gap: 36 }, [
        head('Riconoscimenti', 'Premi e menzioni.'),
        F(
          'Griglia',
          { layout: 'grid', cols: 4, gap: 16, align: 'stretch', over: { tablet: { cols: 2 }, mobile: { cols: 1 } } },
          [
            award('2025', 'Residenze sostenibili'),
            award('2024', 'Miglior interno'),
            award('2023', 'Recupero edilizio'),
            award('2021', 'Giovani studi'),
          ],
        ),
      ])
    }
    case 'awards.press':
      return S('Premi e stampa', { gap: 32 }, [
        T('label', 'Etichetta', 'Hanno scritto di noi', 'eyebrow', { color: 'muted' }),
        F('Testate', { layout: 'grid', cols: 3, gap: 24, over: { mobile: { cols: 1 } } }, [
          quote('“Uno studio che mette la luce al centro.”', '[Testata di architettura]', { bg: null, border: true }),
          quote('“Case che durano più di una moda.”', '[Quotidiano]', { bg: null, border: true }),
          quote('“Il recupero fatto con rispetto.”', '[Rivista di design]', { bg: null, border: true }),
        ]),
      ])
    case 'pricing.one':
      return S('Formule', { align: 'center', gap: 32 }, [
        head('Formula', 'Un prezzo, tutto incluso.', { align: 'center' }),
        F('Formula', { gap: 16, padX: 36, padY: 36, radius: 'card', scheme: 'inverse', maxW: 520, align: 'center' }, [
          T('h', 'Nome', 'Progetto completo', 'h3', { talign: 'center' }),
          T('price', 'Prezzo', 'da [prezzo] €', 'h1', { talign: 'center' }),
          muted('Progetto, pratiche, direzione lavori e consegna.', { talign: 'center' }),
          B('cta', 'Pulsante', 'Richiedi un preventivo', 'primary'),
        ]),
      ])
    case 'pricing.list': {
      const line = (n: string, d: string, p: string) =>
        F(
          'Voce',
          { layout: 'row', justify: 'between', align: 'center', gap: 16, padY: 20, divider: true, wrap: true },
          [
            F('Testo', { gap: 4 }, [T('h', 'Nome', n, 'h3'), muted(d)]),
            T('price', 'Prezzo', p, 'h3', { width: 'hug' }),
          ],
        )
      return S('Formule', { gap: 32 }, [
        head('Listino', 'Tariffe chiare.'),
        F('Listino', { gap: 0 }, [
          line('Consulenza', 'Due ore in studio o sul posto', '450 €'),
          line('Progetto d’interni', 'Per un appartamento fino a 100 m²', 'da [prezzo] €'),
          line('Progetto completo', 'Dal concept alla consegna', 'su misura'),
        ]),
      ])
    }
    case 'team.cards': {
      const card = (n: string, r: string, b: string, tone: Tone) =>
        F('Persona', { gap: 12, padX: 18, padY: 18, radius: 'card', bg: 'surface' }, [
          I('image', 'Foto', { ratio: '1/1', tone }),
          T('h', 'Nome', n, 'h3'),
          T('r', 'Ruolo', r, 'small', { color: 'accent' }),
          muted(b),
        ])
      return S('Team', { gap: 40 }, [
        head('Team', 'Chi lavora con te.'),
        F('Griglia', { layout: 'grid', cols: 3, gap: 20, align: 'stretch', over: { mobile: { cols: 1 } } }, [
          card('Elena Moretti', 'Fondatrice', 'Architetta, segue ogni progetto dal primo incontro.', 1),
          card('Luca Bianchi', 'Architetto', 'Si occupa di pratiche e direzione lavori.', 2),
          card('Sara Conti', 'Interior designer', 'Sceglie materiali, colori e luci.', 3),
        ]),
      ])
    }
    case 'team.founder':
      return S('Team', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
        I('image', 'Ritratto', { ratio: '4/5', tone: 2 }),
        F('Testo', { gap: 18 }, [
          eyebrow('Fondatrice'),
          T('title', 'Titolo', 'Elena Moretti', 'h1'),
          muted(
            'Architetta, ha fondato lo studio nel 2010 dopo dieci anni a Rotterdam. Crede nelle case semplici e nei cantieri ordinati.',
          ),
          T('sign', 'Firma', 'elena@[dominio]', 'small', { weight: 600 }),
        ]),
      ])
    case 'blog.list': {
      const post = (d: string, t: string) =>
        F(
          'Articolo',
          {
            layout: 'row',
            justify: 'between',
            align: 'center',
            gap: 16,
            padY: 20,
            divider: true,
            wrap: true,
            hover: 'dim',
          },
          [T('h', 'Titolo', t, 'h3', { width: 'hug' }), T('d', 'Data', d, 'small', { color: 'muted', width: 'hug' })],
        )
      return S('Articoli', { gap: 32 }, [
        head('Diario', 'Note dallo studio.'),
        F('Elenco', { gap: 0 }, [
          post('12 settembre 2026', 'Come scegliere i serramenti giusti'),
          post('28 agosto 2026', 'Cinque idee per un soggiorno più luminoso'),
          post('3 luglio 2026', 'Ristrutturare senza perdere il carattere'),
        ]),
      ])
    }
    case 'blog.featured':
      return S('Articoli', { layout: 'row', gap: 48, over: { mobile: { layout: 'col', gap: 32 } } }, [
        F('In evidenza', { gap: 14, hover: 'zoomimg' }, [
          I('image', 'Copertina', { ratio: '4/3', tone: 1 }),
          T('date', 'Data', '12 settembre 2026', 'small', { color: 'muted' }),
          T('h', 'Titolo', 'Come scegliere i serramenti giusti', 'h2'),
        ]),
        F('Altri', { gap: 0, maxW: 420 }, [
          T('label', 'Etichetta', 'Altri articoli', 'eyebrow', { color: 'muted', padY: 12 }),
          T('h', 'Titolo', 'Cinque idee per un soggiorno più luminoso', 'h3', { padY: 16, topline: true }),
          T('h', 'Titolo', 'Ristrutturare senza perdere il carattere', 'h3', { padY: 16, topline: true }),
          T('h', 'Titolo', 'Il legno in cucina: sì o no?', 'h3', { padY: 16, topline: true }),
        ]),
      ])
    case 'faq.center': {
      const qa = (q: string, a: string) =>
        F('Domanda', { gap: 8, padY: 20, divider: true }, [T('h', 'Domanda', q, 'h3'), muted(a)])
      return S('FAQ', { align: 'center', gap: 36 }, [
        T('title', 'Titolo', 'Domande frequenti', 'h2', { talign: 'center' }),
        F('Domande', { gap: 0, maxW: 760 }, [
          qa('Quanto costa un progetto?', 'Dipende da superficie e complessità: il primo incontro è gratuito.'),
          qa('Quanto tempo serve?', 'Da tre a dodici mesi, cantiere escluso.'),
          qa('Seguite le pratiche?', 'Sì, tutte, comprese quelle per i bonus.'),
        ]),
      ])
    }
    case 'faq.split':
      return S('FAQ', { layout: 'row', gap: 56, over: { mobile: { layout: 'col', gap: 28 } } }, [
        F('Domande', { gap: 18 }, [
          T('title', 'Titolo', 'Domande', 'h2'),
          F('Domanda', { gap: 6, padY: 16, topline: true }, [
            T('h', 'Domanda', 'Lavorate anche su piccoli interventi?', 'h3'),
            muted('Sì, anche un solo bagno o una cucina.'),
          ]),
          F('Domanda', { gap: 6, padY: 16, topline: true }, [
            T('h', 'Domanda', 'Fate sopralluoghi fuori città?', 'h3'),
            muted('In tutta la Lombardia, senza costi aggiuntivi.'),
          ]),
        ]),
        F('Contatto', { gap: 14, padX: 28, padY: 28, radius: 'card', scheme: 'surface', maxW: 380 }, [
          T('h', 'Titolo', 'Non trovi la risposta?', 'h3'),
          muted('Scrivici: rispondiamo entro un giorno.'),
          B('cta', 'Pulsante', 'Scrivici', 'primary'),
        ]),
      ])
    case 'contact.split':
      return S('Contatti', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
        F('Testo', { gap: 16 }, [
          eyebrow('Contatti'),
          T('title', 'Titolo', 'Vieni a trovarci in studio.', 'h2'),
          muted('Via [indirizzo], Milano · lunedì–venerdì, 9–18'),
          actions(
            {},
            B('cta', 'Pulsante', 'Prenota una visita', 'primary'),
            B('cta2', 'Pulsante', 'Indicazioni', 'ghost'),
          ),
        ]),
        I('image', 'Immagine', { ratio: '4/3', tone: 2 }),
      ])
    case 'contact.hours': {
      const row = (d: string, h: string) =>
        F('Giorno', { layout: 'row', justify: 'between', gap: 12, padY: 12, divider: true }, [
          T('d', 'Giorno', d, 'body', { width: 'hug' }),
          T('h', 'Orario', h, 'body', { color: 'muted', width: 'hug' }),
        ])
      return S('Contatti', { layout: 'row', gap: 64, over: { mobile: { layout: 'col', gap: 32 } } }, [
        F('Recapiti', { gap: 14 }, [
          T('title', 'Titolo', 'Dove e quando', 'h2'),
          T('a', 'Indirizzo', 'Via [indirizzo], Milano', 'body'),
          T('t', 'Telefono', '+39 [telefono]', 'body'),
          T('e', 'Email', 'studio@[dominio]', 'body', { color: 'accent' }),
        ]),
        F('Orari', { gap: 0 }, [
          row('Lunedì–giovedì', '9–18'),
          row('Venerdì', '9–16'),
          row('Sabato', 'su appuntamento'),
          row('Domenica', 'chiuso'),
        ]),
      ])
    }
    case 'contact.cards': {
      const card = (h: string, v: string, b: string) =>
        F('Contatto', { gap: 10, padX: 24, padY: 24, radius: 'card', border: true, hover: 'lift' }, [
          T('h', 'Titolo', h, 'eyebrow', { color: 'muted' }),
          T('v', 'Valore', v, 'h3'),
          muted(b),
        ])
      return S('Contatti', { gap: 40 }, [
        head('Contatti', 'Scegli come preferisci.'),
        F('Modi', { layout: 'grid', cols: 3, gap: 16, align: 'stretch', over: { mobile: { cols: 1 } } }, [
          card('Telefono', '+39 [telefono]', 'Dal lunedì al venerdì.'),
          card('Email', 'studio@[dominio]', 'Rispondiamo entro un giorno.'),
          card('Studio', 'Via [indirizzo]', 'Su appuntamento.'),
        ]),
      ])
    }
    case 'cta.two':
      return S('Invito', { scheme: 'surface', align: 'center', gap: 20, size: 'l' }, [
        T('title', 'Titolo', 'Pronto a cominciare?', 'h1', { talign: 'center' }),
        muted('Un incontro di un’ora, senza impegno.', { talign: 'center' }),
        actions(
          { justify: 'center' },
          B('cta', 'Pulsante', 'Prenota un incontro', 'primary'),
          B('cta2', 'Pulsante', 'Guarda i progetti', 'ghost'),
        ),
      ])
    case 'cta.photo':
      return S('Invito', { bgImage: null, bgDim: 0.5, scheme: 'inverse', align: 'center', gap: 20, size: 'l' }, [
        T('title', 'Titolo', 'La tua casa, come la immagini.', 'h1', { talign: 'center', maxW: 820 }),
        actions({ justify: 'center' }, B('cta', 'Pulsante', 'Parliamone', 'primary')),
      ])
    case 'cta.card':
      return S('Invito', { align: 'center' }, [
        F(
          'Scheda',
          { gap: 16, padX: 48, padY: 48, radius: 'card', scheme: 'accent', align: 'center', maxW: 860, shadow: 'lg' },
          [
            T('title', 'Titolo', 'Un sopralluogo gratuito', 'h2', { talign: 'center' }),
            muted('Veniamo da te, misuriamo e ti diciamo cosa si può fare.', { talign: 'center' }),
            B('cta', 'Pulsante', 'Prenota ora', 'secondary'),
          ],
        ),
      ])
    case 'divider.space':
      return S('Separatore', { size: 'm', gap: 0 }, [])
    case 'divider.quote':
      return S('Separatore', { align: 'center', size: 'm', gap: 14 }, [
        T('quote', 'Citazione', '“La casa è una macchina per abitare.”', 'h2', { talign: 'center', maxW: 760 }),
        T('author', 'Autore', 'Le Corbusier', 'small', { color: 'muted', talign: 'center' }),
      ])
    case 'footer.centered':
      return S('Footer', { align: 'center', gap: 20, size: 's', topline: true }, [
        logo(),
        F(
          'Link',
          { layout: 'row', gap: 24, width: 'hug', wrap: true, justify: 'center' },
          ['Progetti', 'Studio', 'Diario', 'Contatti'].map((t) => T('l', 'Link', t, 'small', { width: 'hug' })),
        ),
        T('legal', 'Note legali', `© ${brand} · P.IVA [numero]`, 'small', { color: 'muted', talign: 'center' }),
      ])
    case 'footer.newsletter':
      return S('Footer', { scheme: 'inverse', gap: 40, size: 'm' }, [
        F('Riga', { layout: 'row', justify: 'between', align: 'end', gap: 32, wrap: true }, [
          F('Iscrizione', { gap: 12, maxW: 460 }, [
            T('h', 'Titolo', 'Una email al mese con i nuovi progetti.', 'h3'),
            F('Modulo', { layout: 'row', gap: 8, wrap: true }, [
              T('fi', 'Campo', 'La tua email', 'small', {
                color: 'muted',
                bg: 'surface',
                padX: 16,
                padY: 12,
                radius: 'btn',
                width: 'fill',
              }),
              B('cta', 'Pulsante', 'Iscriviti', 'primary'),
            ]),
          ]),
          logo(),
        ]),
        F('Riga', { layout: 'row', justify: 'between', gap: 16, wrap: true, topline: true, padY: 20 }, [
          T('legal', 'Note legali', `© ${brand}`, 'small', { color: 'muted', width: 'hug' }),
          F('Link', { layout: 'row', gap: 20, width: 'hug' }, [
            T('l', 'Link', 'Instagram', 'small', { width: 'hug' }),
            T('l', 'Link', 'Privacy', 'small', { width: 'hug' }),
          ]),
        ]),
      ])
    case 'events.list': {
      const ev = (d: string, m: string, h: string, p: string) =>
        F('Evento', { layout: 'row', gap: 24, align: 'center', padY: 18, divider: true, wrap: true }, [
          F('Data', { gap: 0, width: 'fixed', fixedW: 72 }, [
            T('d', 'Giorno', d, 'h2', { color: 'accent' }),
            T('m', 'Mese', m, 'eyebrow', { color: 'muted' }),
          ]),
          F('Testo', { gap: 4 }, [T('h', 'Titolo', h, 'h3'), muted(p)]),
          B('cta', 'Pulsante', 'Iscriviti', 'ghost', { padY: 10, padX: 18 }),
        ])
      return S('Eventi', { gap: 32 }, [
        head('Calendario', 'Prossimi incontri.'),
        F('Elenco', { gap: 0 }, [
          ev('14', 'nov', 'Porte aperte in studio', 'Sabato, 10–17 · Milano'),
          ev('28', 'nov', 'Ristrutturare con i bonus', 'Incontro gratuito · online'),
          ev('12', 'dic', 'Visita al cantiere', 'Casa sul lago · Como'),
        ]),
      ])
    }
    case 'events.cards': {
      const card = (d: string, h: string, tone: Tone) =>
        F('Evento', { gap: 10, hover: 'zoomimg' }, [
          I('image', 'Immagine', { ratio: '4/3', tone }),
          T('d', 'Data', d, 'small', { color: 'accent', weight: 600 }),
          T('h', 'Titolo', h, 'h3'),
        ])
      return S('Eventi', { gap: 36 }, [
        head('Eventi', 'Workshop e visite.'),
        F('Griglia', { layout: 'grid', cols: 3, gap: 24, over: { mobile: { cols: 1 } } }, [
          card('14 novembre', 'Porte aperte', 1),
          card('28 novembre', 'Workshop sui materiali', 2),
          card('12 dicembre', 'Visita al cantiere', 3),
        ]),
      ])
    }
    case 'products.grid': {
      const product = (n: string, p: string, tone: Tone) =>
        F('Prodotto', { gap: 8, hover: 'zoomimg' }, [
          I('image', 'Foto', { ratio: '1/1', tone }),
          F('Riga', { layout: 'row', justify: 'between', gap: 8 }, [
            T('h', 'Nome', n, 'body', { weight: 500, width: 'hug' }),
            T('p', 'Prezzo', p, 'body', { color: 'muted', width: 'hug' }),
          ]),
        ])
      return S('Prodotti', { gap: 36 }, [
        F('Intestazione', { layout: 'row', justify: 'between', align: 'end', gap: 16, wrap: true }, [
          T('title', 'Titolo', 'Oggetti dello studio', 'h2', { width: 'hug' }),
          B('cta', 'Pulsante', 'Vedi tutti', 'ghost'),
        ]),
        F(
          'Griglia',
          {
            layout: 'grid',
            cols: 4,
            gap: 20,
            anim: 'up',
            stagger: true,
            over: { tablet: { cols: 2 }, mobile: { cols: 2, gap: 12 } },
          },
          [
            product('Lampada in ottone', '[prezzo] €', 1),
            product('Sgabello in rovere', '[prezzo] €', 2),
            product('Vaso in ceramica', '[prezzo] €', 3),
            product('Tavolino in pietra', '[prezzo] €', 1),
          ],
        ),
      ])
    }
    case 'products.feature':
      return S('Prodotti', { layout: 'row', gap: 64, align: 'center', over: { mobile: { layout: 'col', gap: 32 } } }, [
        I('image', 'Foto', { ratio: '1/1', tone: 3 }),
        F('Testo', { gap: 16 }, [
          eyebrow('Novità'),
          T('title', 'Titolo', 'Sgabello in rovere', 'h1'),
          T('price', 'Prezzo', '[prezzo] €', 'h3', { color: 'accent' }),
          muted('Legno massello, incastri a mano, finitura a olio. Disegnato nello studio, prodotto in Brianza.'),
          actions({}, B('cta', 'Pulsante', 'Acquista', 'primary'), B('cta2', 'Pulsante', 'Dettagli', 'ghost')),
        ]),
      ])
    case 'compare.table': {
      const row = (f: string, a: string, b: string) =>
        F('Riga', { layout: 'grid', cols: 3, gap: 16, padY: 14, divider: true }, [
          T('f', 'Voce', f, 'body'),
          T('a', 'Base', a, 'body', { color: 'muted', talign: 'center' }),
          T('b', 'Completa', b, 'body', { talign: 'center' }),
        ])
      return S('Confronto', { gap: 32 }, [
        head('Confronto', 'Quale formula fa per te?'),
        F('Tabella', { gap: 0 }, [
          F('Intestazione', { layout: 'grid', cols: 3, gap: 16, padY: 14, divider: true }, [
            T('f', 'Voce', '', 'small'),
            T('a', 'Base', 'Consulenza', 'h3', { talign: 'center' }),
            T('b', 'Completa', 'Progetto completo', 'h3', { talign: 'center', color: 'accent' }),
          ]),
          row('Sopralluogo', '✓', '✓'),
          row('Concept e proposte', '—', '✓'),
          row('Pratiche edilizie', '—', '✓'),
          row('Direzione lavori', '—', '✓'),
        ]),
      ])
    }
    case 'hours.week': {
      const day = (d: string, h: string) =>
        F('Giorno', { gap: 6, padX: 18, padY: 18, radius: 'card', bg: 'surface' }, [
          T('d', 'Giorno', d, 'eyebrow', { color: 'muted' }),
          T('h', 'Orario', h, 'h3'),
        ])
      return S('Orari', { gap: 32 }, [
        head('Orari', 'Quando trovarci.'),
        F('Settimana', { layout: 'grid', cols: 4, gap: 12, over: { mobile: { cols: 2 } } }, [
          day('Lunedì', '9–18'),
          day('Martedì', '9–18'),
          day('Mercoledì', '9–18'),
          day('Giovedì', '9–18'),
          day('Venerdì', '9–16'),
          day('Sabato', 'Su appuntamento'),
          day('Domenica', 'Chiuso'),
        ]),
      ])
    }
  }
  return null
}
