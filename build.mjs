// Render index.html + <slug>/index.html from data.json. Hand-written notes go in <slug>/notes.html
// (any html: text, <img src="sketch.jpg">, video) and are placed under the description.
// usage: node build.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data.json', 'utf8'));

// browser sketches published as github pages: [title, repo]. Served at /<repo>/ via vercel.json rewrite.
const SKETCHES = [
  ['3D Thingy', '3dthingy'], ['Round Plotter', 'round_plotter'], ['Mountains', 'mountains'], ['Territories', 'territories'],
  ['(FUR)niture', 'fur-niture'], ['Memphis', 'memphis'], ['Rocky', 'rocky'], ['Jenim', 'jenim'], ['Drinks', 'drinks'],
  ['Monolith', 'monolith'], ['Blobs', 'blobs'], ['Clint', 'clint'], ['Hairy Thing', 'hairy_thing'],
  ['Marbling', 'marbloble'], ['Plot Thing', 'plot_thing'], ['Thing', 'thing'],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const year = (d) => d.slice(0, 4);
const page = (title, root, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%231a1a1a'/%3E%3Cpath d='M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9l3 3-3 3-3-3z' fill='none' stroke='%23fcfbf8' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
${body}
</body>
</html>
`;

// ---- index
const tile = (href, img, title, meta, w = 4, h = 3) =>
  `<a class="tile" href="${href}">${img ? `<img src="${img}" alt="" loading="lazy" width="${w}" height="${h}">` : ''}` +
  `<span class="label">${esc(title)}</span><span class="meta">${meta}</span></a>`;
const projectTile = (p) => tile(`${p.slug}/`, (p.cover || p.images[0]?.f) && `${p.slug}/${p.cover || p.images[0].f}`, p.title,
  `${esc(p.platform)} · ${year(p.date)} · ${p.series ? `${p.count} editions` : `${p.images.length} works`}`);
const section = (title, note, tiles) =>
  `<section class="shelf"><header><h2>${title}</h2><p>${note}</p></header><div class="tiles">${tiles.join('')}</div></section>`;

writeFileSync('index.html', page('Art — Orr Kislev', '', `<main class="index">
<header class="masthead">
  <a class="back" href="https://orrkislev.work">orrkislev.work</a>
  <h1>Art</h1>
  <p>Generative series, one-off pieces and browser sketches, ${year(data.at(-1).date)}–now. Everything here was made with code.</p>
</header>
${section('Generative series', 'Long-form algorithms, minted on fx(hash). Every edition is a different output of the same code.', data.filter((p) => p.series).map(projectTile))}
${section('Collections', 'Single pieces, hand-picked and minted one by one on Tezos.', data.filter((p) => !p.series).map(projectTile))}
${section('Sketches', 'Live in the browser. Some take a moment to draw.', SKETCHES.map(([t, r]) =>
  tile(`${r}/" data-gh="${r}`, existsSync(`thumbs/${r}.jpg`) && `thumbs/${r}.jpg`, t, 'browser sketch', 1, 1)))}
</main>
<script>// sketch paths are proxied to github pages only on art.orrkislev.work (vercel.json); elsewhere link there directly
if (location.hostname !== 'art.orrkislev.work') document.querySelectorAll('[data-gh]').forEach((a) => a.href = 'https://orrkislev.github.io/' + a.dataset.gh + '/');</script>`));

// ---- project pages
for (const p of data) {
  const notes = existsSync(`${p.slug}/notes.html`) ? `<div class="notes">${readFileSync(`${p.slug}/notes.html`, 'utf8')}</div>` : '';
  // edition field: one cell per minted edition, the ones shown below are lit and clickable
  const shown = new Map(p.images.map((im, i) => [+(im.name.match(/#(\d+)$/) || [])[1], i]));
  const field = p.series ? `<figure class="field" aria-label="${p.images.length} of ${p.count} editions shown">
    <div class="cells">${Array.from({ length: p.count }, (_, k) => shown.has(k + 1)
      ? `<button class="cell on" data-i="${shown.get(k + 1)}" title="#${k + 1}" aria-label="Open #${k + 1}"></button>`
      : '<i class="cell"></i>').join('')}</div>
    <figcaption>${p.images.length} of ${p.count} editions shown</figcaption></figure>` : '';
  writeFileSync(`${p.slug}/index.html`, page(`${p.title} — Orr Kislev`, '../', `<main class="project">
<header class="head">
  <a class="back" href="../">Art</a>
  <h1>${esc(p.title)}</h1>
  <p class="meta">${esc(p.platform)} · ${p.date} · ${p.series ? `${p.count} editions` : `${p.images.length} works`}</p>
  ${p.description ? `<p class="desc">${esc(p.description).replace(/\n+/g, '<br>')}</p>` : ''}
  ${notes}
  ${field}
</header>
<div class="gallery">${p.images.map((im, i) =>
    `<button class="work" data-i="${i}"><img src="${im.f}" alt="${esc(im.name)}" loading="lazy" width="${im.w}" height="${im.h}"></button>`).join('')}</div>
</main>
<dialog class="lightbox">
  <img alt="">
  <p class="cap"><span class="n"></span><span class="c"></span><a target="_blank" rel="noopener noreferrer">objkt ↗</a></p>
  <button class="x" aria-label="Close">×</button><button class="prev" aria-label="Previous">←</button><button class="next" aria-label="Next">→</button>
</dialog>
<script>const WORKS = ${JSON.stringify(p.images.map(({ name, full, url, f }) => ({ name, full, url, f })))};</script>
<script src="../gallery.js"></script>`));
}
console.log('built', data.length, 'projects');
