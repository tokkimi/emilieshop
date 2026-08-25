'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const questions = [
  'En quelle année êtes-vous arrivés dans cette maison ?',
  'Qu’est-ce qui vous avait fait tomber sous son charme ?',
  'Quel est votre tout premier souvenir ici ?',
  'Quel endroit de la maison aimiez-vous particulièrement ?',
  'Quel moment en famille vous revient immédiatement en tête ?',
  'Quelle fête ou occasion spéciale y avez-vous célébrée ?',
  'Y a-t-il une anecdote qui vous fait encore sourire ?',
  'Comment la maison a-t-elle évolué avec votre famille ?',
  'Qu’est-ce qui vous manquera le plus ?',
  'Comment résumeriez-vous vos années ici ?',
];

const extras = [
  { id: 'copy', name: 'Copie famille', detail: 'Un deuxième exemplaire identique', price: 49 },
  { id: 'film', name: 'Mini-film « Notre maison »', detail: '1 à 3 minutes, photos et vidéos', price: 79 },
  { id: 'memory', name: 'Memory Link + carte QR', detail: 'Galerie privée, récit, voix et film', price: 39 },
  { id: 'frame', name: 'Cadre numérique préchargé', detail: 'Vos photos déjà installées', price: 129 },
];

export function BookCustomizer() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('Notre Maison');
  const [years, setYears] = useState('2008 — 2026');
  const [color, setColor] = useState('forest');
  const [format, setFormat] = useState('Essentiel');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedExtras, setSelectedExtras] = useState<string[]>(['memory']);
  const [saved, setSaved] = useState(false);

  const basePrice = format === 'Essentiel' ? 149 : format === 'Souvenir' ? 199 : 249;
  const total = useMemo(() => basePrice + extras.filter((item) => selectedExtras.includes(item.id)).reduce((sum, item) => sum + item.price, 0), [basePrice, selectedExtras]);
  const toggleExtra = (id: string) => setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const next = () => { setSaved(false); setStep((current) => Math.min(4, current + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const previous = () => { setSaved(false); setStep((current) => Math.max(1, current - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <Link className="studio-brand" href="/"><span className="brand-mark">M</span><span>Mémoire<br />Maison</span></Link>
        <p className="studio-kicker">Atelier de création</p>
        <ol className="studio-steps">
          {['Votre livre', 'Votre histoire', 'Vos souvenirs', 'Finitions'].map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}><button onClick={() => setStep(index + 1)}><span>{step > index + 1 ? '✓' : index + 1}</span>{label}</button></li>)}
        </ol>
        <div className="studio-help"><span>♡</span><p><b>Besoin d’aide ?</b><br />Émilie et son équipe vous accompagnent.</p></div>
      </aside>

      <main className="studio-main">
        <div className="studio-top"><p>Votre projet est enregistré automatiquement</p><Link href="/profil">Quitter et reprendre plus tard</Link></div>
        <div className="studio-content">
          <section className="studio-form">
            {step === 1 && <>
              <p className="eyebrow">Étape 1 sur 4</p><h1 className="studio-title">Commençons par la couverture.</h1><p className="studio-intro">Vous pourrez tout modifier avant l’impression. Rien n’est définitif aujourd’hui.</p>
              <label className="field-label">Collection</label><div className="choice-grid three">{['Essentiel', 'Souvenir', 'Famille'].map((item) => <button className={`choice-card ${format === item ? 'selected' : ''}`} key={item} onClick={() => setFormat(item)}><b>{item}</b><small>{item === 'Essentiel' ? '1 livre · 149 $' : item === 'Souvenir' ? 'Finition premium · 199 $' : '3 exemplaires · 249 $'}</small></button>)}</div>
              <label className="field-label" htmlFor="book-title">Titre de votre livre</label><input id="book-title" className="studio-input" value={title} onChange={(event) => setTitle(event.target.value)} />
              <label className="field-label" htmlFor="book-years">Années ou sous-titre</label><input id="book-years" className="studio-input" value={years} onChange={(event) => setYears(event.target.value)} />
              <label className="field-label">Couleur de couverture</label><div className="swatches">{['forest', 'clay', 'linen', 'midnight'].map((item) => <button aria-label={`Couleur ${item}`} key={item} className={`swatch ${item} ${color === item ? 'selected' : ''}`} onClick={() => setColor(item)} />)}</div>
            </>}

            {step === 2 && <>
              <p className="eyebrow">Étape 2 sur 4</p><h1 className="studio-title">Racontez-la simplement.</h1><p className="studio-intro">Écrivez comme vous parleriez à un proche. Vous pouvez passer une question et revenir plus tard.</p>
              <div className="question-list">{questions.map((question, index) => <label key={question} className="question-card"><span><b>{String(index + 1).padStart(2, '0')}</b>{question}</span><textarea value={answers[index] || ''} onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })} placeholder="Votre souvenir…" /><button type="button" className="voice-button" title="Enregistrer une réponse vocale">● Répondre avec ma voix</button></label>)}</div>
            </>}

            {step === 3 && <>
              <p className="eyebrow">Étape 3 sur 4</p><h1 className="studio-title">Ajoutez les images qui comptent.</h1><p className="studio-intro">Jusqu’à 20 photos ou vidéos. Maison, famille, rénovations, jardin, petits détails…</p>
              <label className="upload-zone"><input type="file" multiple accept="image/*,video/*,audio/*" /><span className="upload-icon">＋</span><b>Déposez vos photos ici</b><small>ou cliquez pour parcourir · JPG, PNG, HEIC, MP4</small></label>
              <div className="upload-tips"><h3>Les images qui font les plus beaux livres</h3><p>Une façade, quelques pièces aimées, des moments de vie, et les détails que vous ne voulez pas oublier. La qualité parfaite n’est pas nécessaire.</p></div>
            </>}

            {step === 4 && <>
              <p className="eyebrow">Étape 4 sur 4</p><h1 className="studio-title">Prolongez le souvenir.</h1><p className="studio-intro">Ajoutez uniquement ce qui a du sens pour votre famille. Vous pouvez commander les copies plus tard.</p>
              <div className="extras-list">{extras.map((item) => <label className={`extra-card ${selectedExtras.includes(item.id) ? 'selected' : ''}`} key={item.id}><input type="checkbox" checked={selectedExtras.includes(item.id)} onChange={() => toggleExtra(item.id)} /><span className="extra-check">{selectedExtras.includes(item.id) ? '✓' : '+'}</span><span><b>{item.name}</b><small>{item.detail}</small></span><strong>+ {item.price} $</strong></label>)}</div>
              <div className="total-card"><span><small>Total estimé</small><b>{format} + options</b></span><strong>{total} $ CAD</strong></div>
              <button className="button studio-save" onClick={() => setSaved(true)}>Enregistrer mon projet</button>{saved && <p className="success-note">Votre brouillon est prêt. Connectez-vous pour le retrouver sur tous vos appareils.</p>}
            </>}
          </section>

          <aside className="live-preview">
            <p>Aperçu en direct</p><div className={`preview-book ${color}`}><div className="preview-window"><span className="mini-house" /></div><h2>{title || 'Votre titre'}</h2><small>{years || 'Votre sous-titre'}</small></div><div className="preview-caption"><span>Format 21 × 21 cm</span><span>20 à 30 pages</span></div>
          </aside>
        </div>
        <div className="studio-nav"><button onClick={previous} disabled={step === 1}>← Retour</button><span>{step} / 4</span>{step < 4 ? <button className="button" onClick={next}>Continuer →</button> : <Link className="button" href="/apercu">Générer mon aperçu →</Link>}</div>
      </main>
    </div>
  );
}
