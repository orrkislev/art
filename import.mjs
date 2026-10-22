// Pull everything Orr minted on Tezos (objkt API), group it into projects, download thumbnails.
// Writes data.json + <slug>/img/*.jpg. Re-run any time; existing images are skipped.
// usage: node import.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const ADDRESS = 'tz1efwnKoty6omAwtUTN8ui2TJniNDcrHgSB';
const PER_SERIES = 36; // outputs shown per generative series, spread evenly across the edition
const THUMB = 800; // px, long edge
const COVER = { 'Shine On': 25, 'Practical Instruments': 77 }; // edition used as the index tile
const EXCLUDE = { 'Practical Instruments': [1] }; // editions never shown

const Q = (offset) => `{ token(where:{creators:{creator_address:{_eq:"${ADDRESS}"}}}, order_by:{timestamp:asc}, limit:500, offset:${offset}) {
  fa_contract token_id name timestamp mime display_uri artifact_uri description fa { name } } }`;

const tokens = [];
for (;;) {
  const r = await fetch('https://data.objkt.com/v3/graphql', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: Q(tokens.length) }),
  });
  const page = (await r.json()).data.token;
  tokens.push(...page);
  if (page.length < 500) break;
}
console.log(tokens.length, 'tokens');

// --- grouping: fx(hash)/fx(params) by series name, everything else by hand-written rules
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const platform = (fa) => fa.startsWith('fx(') ? fa.replace(/:.*/, '') : fa === 'Versum Items' ? 'Versum' : 'objkt';
function group(t) {
  const fa = t.fa.name, n = t.name || '', d = t.timestamp.slice(0, 10);
  if (fa.startsWith('fx(')) return n.replace(/\s*#\d+$/, '');
  if (fa === 'Hairy Thing' || n === 'Hi Spirit') return 'Hairy Thing';
  if (n.startsWith('Dots - ')) return 'Dots';
  if (/stalagmite/i.test(n)) return 'Stalagmite';
  if (n.startsWith('cartography')) return 'Cartography';
  if (fa.startsWith('Art  from the year 2024')) return '2024';
  if (d >= '2022-07-28' && d <= '2022-08-31') return 'Summer 2022';
  return 'Other Stuff';
}

const projects = new Map();
for (const t of tokens) {
  if (!t.display_uri || !t.name) continue; // e.g. the text-only "typed" token
  const title = group(t);
  if (!projects.has(title)) projects.set(title, {
    slug: slugify(title), title, series: t.fa.name.startsWith('fx('), platform: platform(t.fa.name),
    date: t.timestamp.slice(0, 10), description: '', count: 0, tokens: [],
  });
  const p = projects.get(title);
  p.count++;
  if (p.series && !p.description) p.description = (t.description || '').trim();
  // editions of the same one-off appear once
  if (!p.tokens.some((x) => x.display_uri === t.display_uri)) p.tokens.push(t);
}

// --- pick + download
const cid = (uri) => uri.replace('ipfs://', '').split('?')[0];
// objkt's CDN: /artifact is the original image, /display the preview (the only image for html/generative tokens)
const cdn = (t) => `https://assets.objkt.media/file/assets-003/${cid(t.mime.startsWith('image/') ? t.artifact_uri : t.display_uri)}/${t.mime.startsWith('image/') ? 'artifact' : 'display'}`;
const pick = (xs, n) => xs.length <= n ? xs : Array.from({ length: n }, (_, i) => xs[Math.floor(i * xs.length / n)]);

const jobs = [], out = [];
for (const p of projects.values()) {
  mkdirSync(`${p.slug}/img`, { recursive: true });
  const ed = (t) => +(t.name.match(/#(\d+)$/) || [])[1];
  const pool = p.tokens.filter((t) => !(EXCLUDE[p.title] || []).includes(ed(t)));
  const picked = pick(pool, p.series ? PER_SERIES : Infinity);
  const cover = pool.find((t) => ed(t) === COVER[p.title]);
  if (cover && !picked.includes(cover)) picked.splice(picked.findIndex((t) => ed(t) > ed(cover)) >>> 0, 0, cover);
  if (cover) p.cover = `img/${cover.token_id}.jpg`;
  const images = picked.map((t) => {
    const img = { f: `img/${t.token_id}.jpg`, name: t.name, full: cdn(t), url: `https://objkt.com/tokens/${t.fa_contract}/${t.token_id}` };
    jobs.push([img, `${p.slug}/${img.f}`]);
    return img;
  });
  delete p.tokens;
  out.push({ ...p, images });
}

async function download([img, path]) {
  if (!existsSync(path)) {
    const r = await fetch(img.full);
    if (!r.ok) return console.log('fail', r.status, path);
    const tmp = path + '.src';
    writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    // ponytail: macOS sips for resizing, swap for sharp if this ever runs elsewhere
    execFileSync('sips', ['-Z', String(THUMB), '-s', 'format', 'jpeg', '-s', 'formatOptions', '78', tmp, '--out', path], { stdio: 'ignore' });
    execFileSync('rm', [tmp]);
  }
  const s = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path]).toString();
  img.w = +s.match(/pixelWidth: (\d+)/)[1];
  img.h = +s.match(/pixelHeight: (\d+)/)[1];
}
let done = 0;
const worker = async () => { while (jobs.length) { await download(jobs.shift()).catch((e) => console.log('fail', e.message)); if (++done % 25 === 0) console.log(done); } };
await Promise.all(Array.from({ length: 6 }, worker));

for (const p of out) p.images = p.images.filter((i) => i.w);
writeFileSync('data.json', JSON.stringify(out.sort((a, b) => b.date.localeCompare(a.date)), null, 1));
console.log(out.length, 'projects');
