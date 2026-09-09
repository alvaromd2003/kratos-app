import { requireManagerRole } from '@/lib/restaurant'
import { getStaffLocale } from '@/lib/i18n/server'
import { staffDict } from '@/lib/i18n/dictionaries/staff'

export default async function HelpPage() {
  await requireManagerRole()
  const t = staffDict[await getStaffLocale()]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-display text-ink">{t['help.title']}</h1>

      <Section title={t['help.section1Title']}>
        <p dangerouslySetInnerHTML={{ __html: t['help.section1P1'] }} />
        <p dangerouslySetInnerHTML={{ __html: t['help.section1P2'] }} />
      </Section>

      <Section title={t['help.section2Title']}>
        <p dangerouslySetInnerHTML={{ __html: t['help.section2P1'] }} />
        <p dangerouslySetInnerHTML={{ __html: t['help.section2P2'] }} />
      </Section>

      <Section title={t['help.section3Title']}>
        <p dangerouslySetInnerHTML={{ __html: t['help.section3P1'] }} />
        <p dangerouslySetInnerHTML={{ __html: t['help.section3P2'] }} />
        <p dangerouslySetInnerHTML={{ __html: t['help.section3P3'] }} />
      </Section>

      <Section title={t['help.section4Title']}>
        <p>{t['help.section4Intro']}</p>
        <ul className="ml-5 list-disc">
          <li dangerouslySetInnerHTML={{ __html: t['help.section4Li1'] }} />
          <li dangerouslySetInnerHTML={{ __html: t['help.section4Li2'] }} />
          <li dangerouslySetInnerHTML={{ __html: t['help.section4Li3'] }} />
        </ul>
        <p dangerouslySetInnerHTML={{ __html: t['help.section4P1'] }} />
      </Section>

      <Section title={t['help.section5Title']}>
        <p dangerouslySetInnerHTML={{ __html: t['help.section5P1'] }} />
        <p dangerouslySetInnerHTML={{ __html: t['help.section5P2'] }} />
      </Section>

      <Section title={t['help.faqTitle']}>
        <p dangerouslySetInnerHTML={{ __html: t['help.faqQ1'] }} />
        <p dangerouslySetInnerHTML={{ __html: t['help.faqQ2'] }} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-l-2 border-marble-3 pl-4">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-bronze">{children}</div>
    </section>
  )
}
