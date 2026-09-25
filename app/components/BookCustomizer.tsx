'use client';

import Link from './SafeLink';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { BOOK_STORAGE_KEY, STUDIO_STORAGE_KEY, bookForStorage, type BookGenerationInput, type BookLocale, type BookMedia, type GeneratedBook } from '../../lib/book';
import { removeLocalMedia, saveLocalMedia } from '../../lib/client-media';
import { EmailAuthForm } from './EmailAuthForm';
import { CART_STORAGE_KEY, CATALOG_ADD_ONS, CATALOG_PLANS, calculateCatalogSubtotal } from '../../lib/catalog';

const copy = {
  fr: {
    questions: ['En quelle année êtes-vous arrivés dans cette maison ?', 'Qu’est-ce qui vous avait fait tomber sous son charme ?', 'Quel est votre tout premier souvenir ici ?', 'Quel endroit de la maison aimiez-vous particulièrement ?', 'Quel moment en famille vous revient immédiatement en tête ?', 'Quelle fête ou occasion spéciale y avez-vous célébrée ?', 'Y a-t-il une anecdote qui vous fait encore sourire ?', 'Comment la maison a-t-elle évolué avec votre famille ?', 'Qu’est-ce qui vous manquera le plus ?', 'Comment résumeriez-vous vos années ici ?'],
    steps: ['Votre livre', 'Votre histoire', 'Vos souvenirs', 'Finitions'], home: '/', profile: '/profil', preview: '/apercu', title: 'Notre Maison', format: ['Essentiel', 'Souvenir', 'Famille'],
  },
  en: {
    questions: ['What year did you move into this home?', 'What first made you fall in love with it?', 'What is your earliest memory here?', 'Which room or corner did you love most?', 'What family moment comes to mind first?', 'What celebration did you share here?', 'What story still makes you smile?', 'How did the home change with your family?', 'What will you miss most?', 'How would you sum up your years here?'],
    steps: ['Your book', 'Your story', 'Your memories', 'Finishing touches'], home: '/en', profile: '/en/profile', preview: '/en/preview', title: 'Our Home', format: ['Essential', 'Keepsake', 'Family'],
  },
};
type LocalAsset = BookMedia & { file: File };
type GenerationResponse = { book: GeneratedBook; generation: { id: string; model: string; usage?: unknown } };

export function BookCustomizer({ locale = 'fr' }: { locale?: BookLocale }) {
  const en = locale === 'en'; const t = copy[locale];
  const [step, setStep] = useState(1); const [title, setTitle] = useState(t.title); const [address, setAddress] = useState(''); const [years, setYears] = useState('2008 — 2026'); const [color, setColor] = useState('white'); const [format, setFormat] = useState(t.format[0]); const [answers, setAnswers] = useState<Record<number, string>>({}); const [selectedExtras, setSelectedExtras] = useState<string[]>([]); const [assets, setAssets] = useState<LocalAsset[]>([]); const [draftReady, setDraftReady] = useState(false); const [generating, setGenerating] = useState(false); const [generationStage, setGenerationStage] = useState(0); const [error, setError] = useState(''); const [authOpen, setAuthOpen] = useState(false);
  const planIndex=Math.max(0,t.format.indexOf(format));const selectedPlan=CATALOG_PLANS[planIndex];const addOns=CATALOG_ADD_ONS.map((item)=>({id:item.id,name:item.name[locale],detail:item.detail[locale],price:item.priceCents/100}));
  const total = useMemo(() => calculateCatalogSubtotal(selectedPlan.id,selectedExtras)/100, [selectedPlan.id,selectedExtras]);

  useEffect(() => { const timer = window.setTimeout(() => { try { const saved = localStorage.getItem(`${STUDIO_STORAGE_KEY}-${locale}`); if (!saved) return; const draft = JSON.parse(saved); const legacy:Record<string,string>={copy:'extra-copy',film:'mini-film',memory:'memory-link',frame:'digital-frame'};setTitle(draft.title || t.title); setAddress(draft.address || ''); setYears(draft.years || ''); setColor(draft.color || 'white'); setFormat(draft.format || t.format[0]); setAnswers(draft.answers || {}); setSelectedExtras((draft.selectedExtras || []).map((id:string)=>legacy[id]||id)); } catch { /* start fresh */ } }, 0); return () => window.clearTimeout(timer); }, [locale, t.format, t.title]);
  useEffect(() => { const timer = window.setTimeout(() => { localStorage.setItem(`${STUDIO_STORAGE_KEY}-${locale}`, JSON.stringify({ title, address, years, color, format, answers, selectedExtras, updatedAt: new Date().toISOString() })); setDraftReady(true); }, 350); return () => window.clearTimeout(timer); }, [address, answers, color, format, locale, selectedExtras, title, years]);

  const toggleExtra = (id: string) => setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const go = (value: number) => { setStep(Math.max(1, Math.min(4, value))); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 40 - assets.length));
    const next = files.map((file) => {
      const id = crypto.randomUUID();
      void saveLocalMedia(id, file);
      return { id, name: file.name, kind: file.type.startsWith('video/') ? 'video' as const : file.type.startsWith('audio/') ? 'audio' as const : 'photo' as const, previewUrl: URL.createObjectURL(file), storageKey: id, file };
    });
    setAssets((current) => [...current, ...next]);
    event.target.value = '';
  };
  const removeAsset = (id: string) => setAssets((current) => {
    const removed = current.find((item) => item.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    void removeLocalMedia(id);
    return current.filter((item) => item.id !== id);
  });

  const createPreview = async () => {
    if (generating) return; setGenerating(true); setError(''); setGenerationStage(0);
    const stageTimer = window.setInterval(() => setGenerationStage((value) => Math.min(3, value + 1)), 1150);
    let projectId: string | undefined;
    try {
      const projectResponse = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, address, years, collection: format, coverColor: color, answers, options: selectedExtras }) });
      if(projectResponse.status===401){setAuthOpen(true);return}
      if (!projectResponse.ok) throw new Error('project');
      projectId = ((await projectResponse.json()) as { id: string }).id;
      let media: BookMedia[] = assets.map(({ id, name, kind, storageKey }) => ({ id, name, kind, storageKey }));
      if (projectId) {
        const uploaded = await Promise.all(assets.map(async (asset) => { const form = new FormData(); form.set('projectId', projectId!); form.set('file', asset.file); const response = await fetch('/api/uploads', { method: 'POST', body: form }); if (!response.ok) return { id: asset.id, name: asset.name, kind: asset.kind, storageKey: asset.storageKey }; const result = (await response.json()) as { id: string }; return { id: result.id, name: asset.name, kind: asset.kind, previewUrl: `/api/media/${result.id}`, storageKey: asset.storageKey }; }));
        media = uploaded;
      }
      const source: BookGenerationInput = { projectId, locale, title: title.trim() || t.title, subtitle: years.trim(), address: address.trim(), collection: format, coverColor: color, answers: Object.fromEntries(Object.entries(answers).map(([key, value]) => [t.questions[Number(key)] || key, value])), media };
      const response = await fetch('/api/generate-book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(source) });
      if (!response.ok) throw new Error('generation');
      const result = (await response.json()) as GenerationResponse;
      const persistentBook = bookForStorage(result.book);
      sessionStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(persistentBook));
      try { localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(persistentBook)); } catch { /* session copy remains available */ }
      const saveResponse = await fetch('/api/book-generations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: result.generation.id, projectId, locale, model: result.generation.model, usage: result.generation.usage, source, book: result.book }) });
      if (!saveResponse.ok) throw new Error('save');
      localStorage.setItem(CART_STORAGE_KEY,JSON.stringify({projectId,planId:selectedPlan.id,addOnIds:selectedExtras,updatedAt:new Date().toISOString()}));
      setGenerationStage(3); window.location.assign(`${t.preview}?book=${encodeURIComponent(result.book.id)}${projectId ? `&project=${encodeURIComponent(projectId)}` : ''}`);
    } catch { setError(en ? 'The preview could not be prepared. Your draft is safe; please try again.' : 'L’aperçu n’a pas pu être préparé. Votre brouillon est conservé; réessayez dans un instant.'); }
    finally { window.clearInterval(stageTimer); setGenerating(false); }
  };
  const stages = en ? ['Preparing your story', 'Composing the pages', 'Placing your memories', 'Your preview is ready'] : ['Préparation de votre récit', 'Composition des pages', 'Placement de vos souvenirs', 'Votre aperçu est prêt'];

  const authModal = authOpen ? <div className="studio-auth-overlay" role="dialog" aria-modal="true" aria-label={en ? 'Create your account' : 'Créez votre compte'}><div className="studio-auth-card"><button type="button" className="studio-auth-close" aria-label={en ? 'Close' : 'Fermer'} onClick={() => setAuthOpen(false)}>×</button><p className="eyebrow">{en ? 'Last step before your preview' : 'Dernière étape avant votre aperçu'}</p><h2>{en ? 'Save your book to your account' : 'Enregistrez votre livre dans votre compte'}</h2><p>{en ? 'Everything you entered stays here. Create your account (or sign in) and we continue right away.' : 'Tout ce que vous avez rempli reste ici. Créez votre compte (ou connectez-vous) et on continue tout de suite.'}</p><EmailAuthForm locale={locale} hideGoogle initialMode="signup" onSuccess={() => { setAuthOpen(false); void createPreview(); }} /></div></div> : null;
  return <div className="studio-shell">{authModal}
    <aside className="studio-sidebar"><Link className="studio-brand" href={t.home}><span className="brand-mark">M</span><span>Mémoire<br />Maison</span></Link><p className="studio-kicker">{en ? 'Creation studio' : 'Atelier de création'}</p><ol className="studio-steps">{t.steps.map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}><button onClick={() => go(index + 1)}><span>{step > index + 1 ? '✓' : index + 1}</span>{label}</button></li>)}</ol><div className="studio-help"><span>♡</span><p><b>{en ? 'Need a hand?' : 'Besoin d’aide ?'}</b><br />{en ? 'Emilie and her team are here for you.' : 'Emilie et son équipe vous accompagnent.'}</p></div></aside>
    <main className="studio-main"><div className="studio-mobile-head"><Link href={t.home}><span className="brand-mark">M</span>Mémoire Maison</Link><b>{step}/4</b></div><div className="studio-mobile-progress"><i style={{ width: `${step * 25}%` }} /></div><div className="studio-top"><p>{draftReady ? (en ? 'Draft saved on this device' : 'Brouillon enregistré sur cet appareil') : (en ? 'Saving…' : 'Enregistrement…')}</p><Link href={t.profile}>{en ? 'Leave and finish later' : 'Quitter et reprendre plus tard'}</Link></div>
      <div className="studio-content"><section className="studio-form">
        {step === 1 && <><p className="eyebrow">{en ? 'Step 1 of 4' : 'Étape 1 sur 4'}</p><h1 className="studio-title">{en ? 'Let’s begin with the cover.' : 'Commençons par la couverture.'}</h1><p className="studio-intro">{en ? 'Everything can be changed before printing. Nothing is final today.' : 'Vous pourrez tout modifier avant l’impression. Rien n’est définitif aujourd’hui.'}</p><label className="field-label">Collection</label><div className="choice-grid three">{t.format.map((item, index) => <button type="button" className={`choice-card ${format === item ? 'selected' : ''}`} key={item} onClick={() => setFormat(item)}><b>{item}</b><small>{CATALOG_PLANS[index].tagline[locale]} · {CATALOG_PLANS[index].priceCents/100} $</small></button>)}</div><label className="field-label" htmlFor="book-title">{en ? 'Book title' : 'Titre de votre livre'}</label><input id="book-title" className="studio-input" value={title} onChange={(event) => setTitle(event.target.value)} /><label className="field-label" htmlFor="book-address">{en ? 'Home address (optional)' : 'Adresse de la maison (facultatif)'}</label><input id="book-address" className="studio-input" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={en ? '284 Maple Street' : '284, rue des Érables'} /><label className="field-label" htmlFor="book-years">{en ? 'Years or subtitle' : 'Années ou sous-titre'}</label><input id="book-years" className="studio-input" value={years} onChange={(event) => setYears(event.target.value)} /><label className="field-label">{en ? 'Cover colour' : 'Couleur de couverture'}</label><div className="swatches">{['white', 'forest', 'clay', 'midnight'].map((item) => <button type="button" aria-label={`${en ? 'Colour' : 'Couleur'} ${item}`} key={item} className={`swatch ${item} ${color === item ? 'selected' : ''}`} onClick={() => setColor(item)} />)}</div></>}
        {step === 2 && <><p className="eyebrow">{en ? 'Step 2 of 4' : 'Étape 2 sur 4'}</p><h1 className="studio-title">{en ? 'Tell it in your own words.' : 'Racontez-la simplement.'}</h1><p className="studio-intro">{en ? 'Write as you would speak to someone you love. Every answer can be edited later.' : 'Écrivez comme vous parleriez à un proche. Chaque réponse pourra être modifiée plus tard.'}</p><div className="question-list">{t.questions.map((question, index) => <label key={question} className="question-card"><span><b>{String(index + 1).padStart(2, '0')}</b>{question}</span><textarea value={answers[index] || ''} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} placeholder={en ? 'Your memory…' : 'Votre souvenir…'} /><span className="answer-count">{(answers[index] || '').length}/5 000</span></label>)}</div></>}
        {step === 3 && <><p className="eyebrow">{en ? 'Step 3 of 4' : 'Étape 3 sur 4'}</p><h1 className="studio-title">{en ? 'Add the memories that matter.' : 'Ajoutez les souvenirs qui comptent.'}</h1><p className="studio-intro">{en ? 'Photos go into the printed book. Films and voices remain playable in the private digital version and accessible from the paper book.' : 'Les photos prennent place dans le livre imprimé. Les films et les voix restent lisibles dans la version numérique privée et accessibles depuis le livre papier.'}</p><label className="upload-zone"><input type="file" multiple accept="image/*,video/*,audio/*" onChange={addFiles} /><span className="upload-icon">＋</span><b>{en ? 'Choose photos, films or voices' : 'Choisir des photos, films ou voix'}</b><small>{en ? 'Camera roll or files · up to 40 items' : 'Pellicule ou fichiers · jusqu’à 40 éléments'}</small></label>{assets.length > 0 && <div className="media-grid">{assets.map((asset) => <article key={asset.id}>{asset.kind === 'photo' ? <img src={asset.previewUrl} alt="" /> : asset.kind === 'video' ? <video src={asset.previewUrl} muted playsInline /> : <div className="audio-tile">◉</div>}<span>{asset.kind === 'photo' ? 'Photo' : asset.kind === 'video' ? 'Film' : (en ? 'Voice' : 'Voix')}</span><button type="button" onClick={() => removeAsset(asset.id)} aria-label={en ? 'Remove' : 'Supprimer'}>×</button><small>{asset.name}</small></article>)}</div>}<div className="upload-tips"><h3>{en ? 'A balanced selection works best' : 'Une sélection équilibrée donne le plus beau résultat'}</h3><p>{en ? 'Add the façade, loved rooms, everyday scenes, family moments and a few small details. You can reorder or replace everything in the preview.' : 'Ajoutez la façade, les pièces aimées, des scènes du quotidien, des moments de famille et quelques détails. Vous pourrez tout réordonner ou remplacer dans l’aperçu.'}</p></div></>}
        {step === 4 && <><p className="eyebrow">{en ? 'Step 4 of 4' : 'Étape 4 sur 4'}</p><h1 className="studio-title">{en ? 'Let the memory live on.' : 'Prolongez le souvenir.'}</h1><p className="studio-intro">{en ? 'Your first preview is included. You review and edit it before any print approval.' : 'Votre premier aperçu est inclus. Vous le relisez et le modifiez avant toute validation d’impression.'}</p><div className="extras-list">{addOns.map((item) => <label className={`extra-card ${selectedExtras.includes(item.id) ? 'selected' : ''}`} key={item.id}><input type="checkbox" checked={selectedExtras.includes(item.id)} onChange={() => toggleExtra(item.id)} /><span className="extra-check">{selectedExtras.includes(item.id) ? '✓' : '+'}</span><span><b>{item.name}</b><small>{item.detail}</small></span><strong>+ {item.price} $</strong></label>)}</div><div className="total-card"><span><small>{en ? 'Estimated total' : 'Total estimé'}</small><b>{format} + options</b></span><strong>{total} $ CAD</strong></div>{error && <p className="studio-error" role="alert">{error}</p>}</>}
      </section><aside className="live-preview"><p>{en ? 'Live cover preview' : 'Aperçu de couverture'}</p><div className={`preview-book ${color}`}><div className="preview-window"><span className="mini-house" /></div><h2>{title || t.title}</h2><small>{years || (en ? 'Your subtitle' : 'Votre sous-titre')}</small></div><div className="preview-caption"><span>21,6 × 21,6 cm</span><span>24 pages</span></div></aside></div>
      <div className="studio-nav"><button type="button" onClick={() => go(step - 1)} disabled={step === 1}>← {en ? 'Back' : 'Retour'}</button><span>{step} / 4</span>{step < 4 ? <button type="button" className="button" onClick={() => go(step + 1)}>{en ? 'Continue' : 'Continuer'} →</button> : <button type="button" className="button" onClick={createPreview} disabled={generating}>{generating ? (en ? 'Preparing…' : 'Préparation…') : (en ? 'Create my preview →' : 'Créer mon aperçu →')}</button>}</div>
    </main>{generating && <div className="generation-overlay" role="status" aria-live="polite"><div className="generation-card"><span className="generation-mark">M</span><p className="eyebrow">{en ? 'Your book is taking shape' : 'Votre livre prend forme'}</p><h2>{stages[generationStage]}</h2><div className="generation-track"><i style={{ width: `${(generationStage + 1) * 25}%` }} /></div><ol>{stages.map((label, index) => <li key={label} className={index <= generationStage ? 'active' : ''}><span>{index < generationStage ? '✓' : index + 1}</span>{label}</li>)}</ol><small>{en ? 'Keep this window open for a few moments.' : 'Gardez cette fenêtre ouverte quelques instants.'}</small></div></div>}
  </div>;
}
