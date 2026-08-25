import Link from 'next/link';

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`site-header ${compact ? 'header-compact' : ''}`}>
      <Link className="brand" href="/" aria-label="Mémoire Maison - Accueil">
        <span className="brand-mark">M</span><span>Mémoire Maison</span>
      </Link>
      <nav className="main-nav" aria-label="Navigation principale">
        <Link href="/#comment">Comment ça marche</Link>
        <Link href="/#collections">Collections</Link>
        <Link href="/professionnels">Professionnels</Link>
        <Link href="/memory/demo">Memory Link</Link>
      </nav>
      <div className="header-actions">
        <Link className="text-link" href="/profil">Mon espace</Link>
        <Link className="button button-small" href="/atelier">Créer mon livre</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><div className="brand footer-brand"><span className="brand-mark">M</span><span>Mémoire Maison</span></div><p>Conserver l’histoire des lieux,<br />un chapitre à la fois.</p></div>
      <div><h4>Explorer</h4><Link href="/#comment">Comment ça marche</Link><Link href="/#collections">Collections</Link><Link href="/atelier">Créer mon livre</Link></div>
      <div><h4>Professionnels</h4><Link href="/professionnels">Offre courtiers</Link><Link href="/admin">Administration</Link><a href="mailto:bonjour@memoiremaison.ca">Nous écrire</a></div>
      <div><h4>Recevoir nos histoires</h4><p>Une lettre douce sur la maison, la mémoire et les nouveaux départs.</p><form className="newsletter"><label className="sr-only" htmlFor="newsletter-email">Votre courriel</label><input id="newsletter-email" type="email" placeholder="Votre courriel" /><button type="submit">→</button></form></div>
      <small>© 2026 Mémoire Maison · Québec, Canada · Confidentialité · Consentements</small>
    </footer>
  );
}
