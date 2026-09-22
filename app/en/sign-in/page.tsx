import type { Metadata } from 'next';
import Link from '../../components/SafeLink';
import { SiteHeader } from '../../components/SiteHeader';
import { EmailAuthForm } from '../../components/EmailAuthForm';
export const metadata:Metadata={title:'Sign in — Mémoire Maison',robots:{index:false,follow:false}};
export default function SignInPage(){return <><SiteHeader locale="en" compact/><main className="login-page"><section className="login-card"><Link className="brand login-brand" href="/en"><span className="brand-mark">M</span><span>Mémoire Maison</span></Link><p className="eyebrow">Welcome</p><h1>Find your stories again.</h1><p>Sign in or create your account to save projects, message the team and approve your books.</p><EmailAuthForm locale="en" fallback="/en/profile"/><p className="legal-login">By continuing, you agree to the <Link href="/en/terms">Terms</Link> and <Link href="/en/privacy">Privacy Policy</Link>.</p></section><aside className="login-visual"><div className="login-book"><span>OUR<br/>HOME</span><small>Your memories are waiting.</small></div><blockquote>“A place to tell,<br/>revisit and pass it on.”</blockquote></aside></main></>}
