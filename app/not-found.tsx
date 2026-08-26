import Link from './components/SafeLink';
import { SiteFooter, SiteHeader } from './components/SiteHeader';

export default function NotFound() {
  return <><SiteHeader compact/><main className="not-found-page"><p className="eyebrow">Erreur 404</p><h1>Cette page a changé d’adresse.</h1><p>Votre histoire, elle, est toujours là. Revenez à l’accueil ou reprenez la création de votre livre.</p><div><Link className="button" href="/">Retour à l’accueil</Link><Link className="quiet-link" href="/atelier">Créer mon livre →</Link></div></main><SiteFooter/></>;
}
