import type { Metadata } from 'next';
import Link from '../../../components/SafeLink';
import { SiteHeader } from '../../../components/SiteHeader';
import { UpdatePasswordForm } from '../../../components/UpdatePasswordForm';

export const metadata: Metadata = { title: 'New password — Mémoire Maison', robots: { index: false, follow: false } };

export default function ResetPasswordPageEn() {
  return (
    <>
      <SiteHeader locale="en" compact />
      <main className="login-page">
        <section className="login-card">
          <Link className="brand login-brand" href="/en"><span className="brand-mark">M</span><span>Mémoire Maison</span></Link>
          <p className="eyebrow">Security</p>
          <h1>Choose a password.</h1>
          <p>Enter a new password for your account, then you will be redirected to your profile.</p>
          <UpdatePasswordForm locale="en" />
          <p className="legal-login"><Link href="/en/sign-in">← Back to sign in</Link></p>
        </section>
        <aside className="login-visual">
          <div className="login-book"><span>OUR<br />HOME</span><small>Your memories are waiting.</small></div>
          <blockquote>“A place to tell,<br />revisit and pass it on.”</blockquote>
        </aside>
      </main>
    </>
  );
}
