'use client';
import { useState } from 'react';
import type { GeneratedBook } from '../../lib/book';
import { BookFlip } from './BookFlip';
import { BookPageView } from './BookPageView';
import '../book-editor.css';
import './memory-reader.css';
export function MemoryBookReader({ book, en = false }: { book: GeneratedBook; en?: boolean }) {
  const [open, setOpen] = useState(false);
  const url = (id: string) => book.media.find((item) => item.id === id)?.previewUrl;
  const hero = book.media.find((item) => item.id === book.pages[0]?.mediaIds[0]) || book.media.find((item) => item.kind === 'photo');
  const living = book.media.filter((item) => item.kind !== 'photo' && item.previewUrl);
  return <main className="memory-reader"><section className="mr-hero">
    {hero?.previewUrl && <img className="mr-hero-photo" src={hero.previewUrl} alt=""/>}
    <header><img src="/memoire-maison-logo.png" alt="Mémoire Maison"/><span>{en ? 'Private family memories' : 'Vos souvenirs en famille'}</span></header>
    <div><p className="eyebrow">MEMORY LINK</p><h1>{book.title}</h1><p>{book.subtitle}</p><button onClick={() => setOpen(true)}>{en ? 'Flip through the book' : 'Feuilleter le livre'} <span aria-hidden="true">↗︎</span></button><a href="#histoire">{en ? 'Read the story ↓' : 'Parcourir l’histoire ↓'}</a></div>
  </section><section className="mr-intro" id="histoire"><div className="mr-book" onClick={() => setOpen(true)} role="button" tabIndex={0} onKeyDown={(event) => {if(event.key==='Enter'||event.key===' ')setOpen(true);}} aria-label={en?'Open the book':'Ouvrir le livre'}><BookPageView page={book.pages[0]} book={book} index={0} photoUrl={url}/></div><div><p className="eyebrow">{en?'A story to pass on':'Une histoire à transmettre'}</p><h2>{en?'A home. A thousand memories.':'Une maison. Mille souvenirs.'}</h2><p>{en?'Turn the pages of your book, or take your time with the photographs and stories below.':'Tournez les pages de votre livre, ou prenez le temps de retrouver les photographies et les récits ci-dessous.'}</p><button onClick={() => setOpen(true)}>{en?'Open my book':'Ouvrir mon livre'} →</button></div></section>
  <div className="mr-chapters">{book.pages.filter((page)=>page.kind!=='cover'&&page.kind!=='interactive').map((page,index)=><section className={`mr-chapter ${index%2?'reverse':''}`} key={page.id}>{page.mediaIds.length>0&&<div className={`mr-images count-${Math.min(page.mediaIds.length,4)}`}>{page.mediaIds.slice(0,4).map((id)=>url(id)&&<img key={id} src={url(id)} alt="" loading="lazy"/>)}</div>}<div className="mr-copy">{page.eyebrow&&<small>{page.eyebrow}</small>}<h2>{page.title}</h2>{page.body&&<p>{page.body}</p>}{page.quote&&<blockquote>{page.quote}</blockquote>}</div></section>)}</div>
  {living.length>0&&<section className="mr-living" id="films"><p className="eyebrow">{en?'Living memories':'Souvenirs vivants'}</p><h2>{en?'Watch. Listen. Remember.':'Voir. Écouter. Se souvenir.'}</h2><div>{living.map((item)=><figure key={item.id}><figcaption>{item.name}</figcaption>{item.kind==='video'?<video src={item.previewUrl} controls playsInline preload="metadata"/>:<audio src={item.previewUrl} controls preload="metadata"/>}</figure>)}</div></section>}
  <footer><img src="/memoire-maison-logo.png" alt="Mémoire Maison"/><button onClick={()=>setOpen(true)}>{en?'Flip through again':'Feuilleter à nouveau'} →</button></footer>
  {open&&<BookFlip book={book} photoUrl={url} en={en} onClose={()=>setOpen(false)} livingMedia={living}/>}
  </main>;
}
