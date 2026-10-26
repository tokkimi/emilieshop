import Link from './SafeLink';
import { SiteFooter, SiteHeader } from './SiteHeader';
import { PRINTER_IDS, PRINTERS } from '../../lib/printers';

/** First step of the studio: pick the print partner, with both side by side. */
export function PrinterChoice({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const en = locale === 'en';
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="printer-choice">
        <p className="eyebrow">{en ? 'Creation studio' : 'Atelier de création'}</p>
        <h1>{en ? 'Choose who prints your book' : 'Choisissez qui imprime votre livre'}</h1>
        <p className="printer-choice-intro">
          {en
            ? 'Same studio, same story, same preview. Only the print partner changes. Compare, then start.'
            : 'Même atelier, même histoire, même aperçu. Seul l’imprimeur change. Comparez, puis lancez-vous.'}
        </p>
        <div className="printer-grid">
          {PRINTER_IDS.map((id) => {
            const printer = PRINTERS[id];
            return (
              <article className="printer-card" key={id}>
                <h2>{printer.name}</h2>
                <p>{printer.tagline[locale]}</p>
                <dl>
                  {printer.specs.map((spec) => (
                    <div key={spec.label.fr}>
                      <dt>{spec.label[locale]}</dt>
                      <dd>{spec.value[locale]}</dd>
                    </div>
                  ))}
                </dl>
                <Link className="button" href={printer.path[locale]}>
                  {en ? `Create with ${printer.name}` : `Créer avec ${printer.name}`}
                </Link>
              </article>
            );
          })}
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
