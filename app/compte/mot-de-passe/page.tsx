import type { Metadata } from 'next';
import Link from '../../components/SafeLink';
import { SiteHeader } from '../../components/SiteHeader';
import { UpdatePasswordForm } from '../../components/UpdatePasswordForm';

export const metadata: Metadata = { title: 'Nouveau mot de passe — Mémoire Maison', robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader compact />
      <main className="login-page">
        <section className="login-card">
          <Link className="brand login-brand" href="/"><span className="brand-mark">M</span><span>Mémoire Maison</span></Link>
          <p className="eyebrow">Sécurité</p>
          <h1>Choisissez un mot de passe.</h1>
          <p>Entrez un nouveau mot de passe pour votre compte, puis vous serez redirigé vers votre profil.</p>
          <UpdatePasswordForm />
          <p className="legal-login"><Link href="/connexion">← Retour à la connexion</Link></p>
        </section>
        <aside className="login-visual">
          <div className="login-book"><span>NOTRE<br />MAISON</span><small>Vos souvenirs vous attendent.</small></div>
          <blockquote>« Un endroit pour raconter,<br />relire et transmettre. »</blockquote>
        </aside>
      </main>
    </>
  );
}
