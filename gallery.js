// lightbox for project pages. WORKS = [{ name, full, url, f }] is inlined by build.mjs
const box = document.querySelector('.lightbox');
const img = box.querySelector('img');
let at = 0;

function show(i) {
  at = (i + WORKS.length) % WORKS.length;
  const w = WORKS[at];
  img.src = w.f; // local thumb first, then swap to the full image from objkt
  const full = new Image();
  full.onload = () => { if (WORKS[at] === w) img.src = w.full; };
  full.src = w.full;
  box.querySelector('.n').textContent = w.name;
  box.querySelector('.c').textContent = `${at + 1} / ${WORKS.length}`;
  box.querySelector('a').href = w.url;
  document.querySelectorAll('.cell.hot').forEach((c) => c.classList.remove('hot'));
  document.querySelector(`.cell[data-i="${at}"]`)?.classList.add('hot');
  if (!box.open) box.showModal();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-i]');
  if (t) show(+t.dataset.i);
});
box.querySelector('.x').onclick = () => box.close();
box.querySelector('.prev').onclick = () => show(at - 1);
box.querySelector('.next').onclick = () => show(at + 1);
img.onclick = () => box.close();
box.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') show(at - 1);
  if (e.key === 'ArrowRight') show(at + 1);
});
box.addEventListener('close', () => document.querySelectorAll('.cell.hot').forEach((c) => c.classList.remove('hot')));
