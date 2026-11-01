import { useQuery } from '@tanstack/react-query'
import { BookOpen, Bug, Code, FileText, Scale, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '../app/Auth.tsx'
import { api } from '../lib/api.ts'

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
    <div className="mx-auto max-w-xl space-y-6 px-5 py-8">
      <div className="flex items-center gap-4">
        <Logo className="size-12" />
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">Materialize</h2>
          <p className="text-[14px] text-fg2">
            {version ? `Versione ${version}` : 'Versione…'} · CMS open source con editor visuale
          </p>
        </div>
      </div>

      <p className="text-[14px] leading-relaxed text-fg2">
        Realizzato da{' '}
        <a
          href="https://cristianocasazza.com"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-fg hover:underline"
        >
          Cristiano Casazza Consulting
        </a>
        . Distribuito con licenza MIT: puoi usarlo, modificarlo e ridistribuirlo liberamente, anche per i siti dei tuoi
        clienti.
      </p>

      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
        <Row
          href={`${REPO}/blob/main/CHANGELOG.md`}
          icon={<Sparkles />}
          title="Novità"
          detail="Cosa è cambiato in ogni versione"
        />
        <Row
          href={`${REPO}/blob/main/docs/guida/README.md`}
          icon={<BookOpen />}
          title="Guida"
          detail="Come si usa, passo per passo"
        />
        <Row href={REPO} icon={<Code />} title="Codice sorgente" detail="github.com/materializecms/materialize" />
        <Row
          href={`${REPO}/issues`}
          icon={<Bug />}
          title="Segnala un problema"
          detail="Senza incollare password, chiavi o token"
        />
        <Row href={`${REPO}/blob/main/LICENSE`} icon={<Scale />} title="Licenza MIT" detail="Il testo completo" />
        <Row
          href="/admin/THIRD-PARTY-LICENSES.txt"
          icon={<FileText />}
          title="Licenze di terzi"
          detail="Il codice, i caratteri e le icone di altri progetti inclusi nel pannello"
        />
      </div>
    </div>
  )
}
