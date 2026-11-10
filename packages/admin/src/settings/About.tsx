import { useQuery } from '@tanstack/react-query'
import { BookOpen, Bug, Code, FileText, Scale, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '../app/Auth.tsx'
import { api } from '../lib/api.ts'
import { t, tx } from '../lib/i18n.ts'
import { SettingsPage, settingsCard } from './SettingsPage.tsx'

const REPO = 'https://github.com/materializecms/materialize'

function Row({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-hover [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg3"
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[13px] text-fg3">{detail}</span>
      </span>
    </a>
  )
}

/** Impostazioni → Informazioni: the version, who makes Materialize, its license and the others' licenses. */
export function About() {
  const version = useQuery({ queryKey: ['health'], queryFn: api.health }).data?.version
  return (
    <SettingsPage className="space-y-6">
      <div className="flex items-center gap-4">
        <Logo className="size-12" />
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Materialize</h2>
          <p className="mt-1 text-[13px] text-fg2">
            {version ? t('Versione {version}', { version }) : t('Versione…')} ·{' '}
            {t('CMS open source con editor visuale')}
          </p>
        </div>
      </div>

      <p className="text-[14px] leading-relaxed text-fg2">
        {tx(
          'Realizzato da {author}. Distribuito con licenza MIT: puoi usarlo, modificarlo e ridistribuirlo liberamente, anche per i siti dei tuoi clienti.',
          {
            author: (
              <a
                href="https://cristianocasazza.com"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-fg hover:underline"
              >
                Cristiano Casazza Consulting
              </a>
            ),
          },
        )}
      </p>

      <div className={`divide-y divide-line overflow-hidden ${settingsCard}`}>
        <Row
          href={`${REPO}/blob/main/CHANGELOG.md`}
          icon={<Sparkles />}
          title={t('Novità')}
          detail={t('Cosa è cambiato in ogni versione')}
        />
        <Row
          href={`${REPO}/blob/main/docs/guida/README.md`}
          icon={<BookOpen />}
          title={t('Guida')}
          detail={t('Come si usa, passo per passo')}
        />
        <Row href={REPO} icon={<Code />} title={t('Codice sorgente')} detail="github.com/materializecms/materialize" />
        <Row
          href={`${REPO}/issues`}
          icon={<Bug />}
          title={t('Segnala un problema')}
          detail={t('Senza incollare password, chiavi o token')}
        />
        <Row
          href={`${REPO}/blob/main/LICENSE`}
          icon={<Scale />}
          title={t('Licenza MIT')}
          detail={t('Il testo completo')}
        />
        <Row
          href="/admin/THIRD-PARTY-LICENSES.txt"
          icon={<FileText />}
          title={t('Licenze di terzi')}
          detail={t('Il codice, i caratteri e le icone di altri progetti inclusi nel pannello')}
        />
      </div>
    </SettingsPage>
  )
}
