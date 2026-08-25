import Link from './SafeLink';
import { HomeThemeSelector } from './HomeThemeSelector';
import { NewsletterForm } from './NewsletterForm';

export function SiteHeader({ compact = false, locale = 'fr', homeThemes = locale === 'en' }: { compact?: boolean; locale?: 'fr' | 'en'; homeThemes?: boolean }) {
  const en = locale === 'en';
  return (
    <header className={`site-header ${compact ? 'header-compact' : ''}`}>
      <Link className="brand" href={en ? '/en' : '/'} aria-label={`Mémoire Maison - ${en ? 'Home' : 'Accueil'}`}>
        <span className="brand-mark">M</span><span>Mémoire Maison</span>
      </Link>
      <nav className="main-nav" aria-label="Navigation principale">
        <Link href={en ? '/en#how' : '/#comment'}>{en ? 'How it works' : 'Comment ça marche'}</Link>
        <Link href={en ? '/en#collections' : '/#collections'}>Collections</Link>
        <Link href={en ? '/en/professionals' : '/professionnels'}>{en ? 'Professionals' : 'Professionnels'}</Link>
        <Link href={en ? '/en/memory/demo' : '/memory/demo'}>Memory Link</Link>
      </nav>
      <div className="header-actions">
        {homeThemes ? <HomeThemeSelector locale={locale} /> : null}
        <Link className="locale-link" href={en ? '/' : '/en'}>{en ? 'FR' : 'EN'}</Link>
        <Link className="text-link" href={en ? '/en/sign-in' : '/connexion'}>{en ? 'Sign in' : 'Connexion'}</Link>
        <Link className="button button-small" href={en ? '/en/studio' : '/atelier'}>{en ? 'Create my book' : 'Créer mon livre'}</Link>
      </div>
    </header>
  );
}

export function SiteFooter({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const en = locale === 'en';
  return (
    <footer className="site-footer">
      <div><div className="brand footer-brand"><span className="brand-mark">M</span><span>Mémoire Maison</span></div><p>{en ? <>Preserving the story of places,<br />one chapter at a time.</> : <>Conserver l’histoire des lieux,<br />un chapitre à la fois.</>}</p></div>
      <div><h4>{en ? 'Explore' : 'Explorer'}</h4><Link href={en ? '/en#how' : '/#comment'}>{en ? 'How it works' : 'Comment ça marche'}</Link><Link href={en ? '/en#collections' : '/#collections'}>Collections</Link><Link href={en ? '/en/studio' : '/atelier'}>{en ? 'Create my book' : 'Créer mon livre'}</Link></div>
      <div><h4>{en ? 'Professionals' : 'Professionnels'}</h4><Link href={en ? '/en/professionals' : '/professionnels'}>{en ? 'Realtor offer' : 'Offre courtiers'}</Link>{!en ? <Link href="/admin">Administration</Link> : null}<a href="mailto:bonjour@memoiremaison.ca">{en ? 'Contact us' : 'Nous écrire'}</a></div>
      <div><h4>{en ? 'Receive our stories' : 'Recevoir nos histoires'}</h4><p>{en ? 'A gentle letter about home, memory and new beginnings.' : 'Une lettre douce sur la maison, la mémoire et les nouveaux départs.'}</p><NewsletterForm locale={locale} /></div>
      <small>© 2026 Mémoire Maison · Québec, Canada · <Link href={en ? '/en/terms' : '/conditions-generales'}>{en ? 'Terms' : 'Conditions générales'}</Link> · <Link href={en ? '/en/privacy' : '/politique-confidentialite'}>{en ? 'Privacy' : 'Confidentialité'}</Link> · {!en ? <><Link href="/consentements">Consentements</Link> · <Link href="/livraison-retours">Livraison & retours</Link></> : 'Consents'}</small>
    </footer>
  );
}
