const fs   = require('fs');
const path = require('path');
const { marked } = require('marked');

const CONTENT = path.join(__dirname, 'content');
const DIST    = path.join(__dirname, 'dist');

const LAYERS = [
  { file: 'Layer-0-Vault-Setup.md',        slug: 'layer-0', label: 'Layer 0', title: 'Vault Setup' },
  { file: 'Layer-1-Morning-Brief.md',       slug: 'layer-1', label: 'Layer 1', title: 'Morning Brief' },
  { file: 'Layer-1.5-Make-It-Yours.md',     slug: 'layer-1-5', label: 'Layer 1.5', title: 'Make It Yours' },
  { file: 'Layer-2-RSS-Flywheel.md',        slug: 'layer-2', label: 'Layer 2', title: 'RSS Flywheel' },
  { file: 'Layer-3-Content-Intelligence.md',slug: 'layer-3', label: 'Layer 3', title: 'Content Intelligence' },
  { file: 'Layer-4-Agent-Swarm.md',         slug: 'layer-4', label: 'Layer 4', title: 'Agent Swarm' },
];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

// ── Shared layout ────────────────────────────────────────────────────────────

function nav(activeSlug) {
  const items = [
    { slug: 'index', label: 'Overview' },
    { slug: 'orientation', label: 'Start Here — Why This Works' },
    ...LAYERS.map(l => ({ slug: l.slug, label: `${l.label} — ${l.title}` }))
  ];
  return items.map(item => {
    const active = item.slug === activeSlug ? ' class="active"' : '';
    const href   = item.slug === 'index' ? 'index.html' : `${item.slug}.html`;
    return `<a href="${href}"${active}>${item.label}</a>`;
  }).join('\n');
}

function page({ slug, title, body, rawMd, prev, next }) {
  const copyBlock = rawMd ? `
  <div class="copy-bar">
    <div class="copy-bar-text">
      <span class="copy-label">Builder Agent Prompt</span>
      <span class="copy-hint">Paste this into a Claude Code session to build this layer</span>
    </div>
    <button class="copy-btn" onclick="copyPrompt()">Copy prompt</button>
  </div>
  <script id="raw" type="application/json">${JSON.stringify(rawMd)}</script>
  <script>
    function copyPrompt() {
      const raw = JSON.parse(document.getElementById('raw').textContent);
      navigator.clipboard.writeText(raw).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy prompt'; btn.classList.remove('copied'); }, 2000);
      });
    }
  </script>` : '';

  const pagination = (prev || next) ? `
  <div class="pagination">
    ${prev ? `<a href="${prev.slug}.html" class="page-link prev">← ${prev.label} — ${prev.title}</a>` : '<span></span>'}
    ${next ? `<a href="${next.slug}.html" class="page-link next">${next.label} — ${next.title} →</a>` : '<span></span>'}
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Compound Starter</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <a href="/index.html" class="brand">Compound Starter</a>
    ${nav(slug)}
  </nav>
  <main class="content">
    ${copyBlock}
    <article class="prose">
      ${body}
    </article>
    ${pagination}
  </main>
</div>
</body>
</html>`;
}

// ── Build index from README ──────────────────────────────────────────────────

const readmeSrc = path.join(CONTENT, 'README.md');
if (fs.existsSync(readmeSrc)) {
  const md   = fs.readFileSync(readmeSrc, 'utf8');
  const body = marked(md);
  fs.writeFileSync(path.join(DIST, 'index.html'), page({
    slug: 'index', title: 'Overview', body, rawMd: null
  }));
  console.log('Built: index.html');
}

// ── Build orientation (read-first concept page, no copy-prompt) ───────────────

const orientSrc = path.join(CONTENT, 'Orientation.md');
if (fs.existsSync(orientSrc)) {
  const md   = fs.readFileSync(orientSrc, 'utf8');
  const body = marked(md);
  fs.writeFileSync(path.join(DIST, 'orientation.html'), page({
    slug: 'orientation', title: 'Start Here — Why This Works', body, rawMd: null,
    next: LAYERS[0]
  }));
  console.log('Built: orientation.html');
}

// ── Build each layer ─────────────────────────────────────────────────────────

LAYERS.forEach((layer, i) => {
  const src = path.join(CONTENT, layer.file);
  if (!fs.existsSync(src)) { console.warn(`Missing: ${layer.file}`); return; }

  const rawMd = fs.readFileSync(src, 'utf8');
  const body  = marked(rawMd);
  const prev  = i > 0 ? LAYERS[i - 1] : null;
  const next  = i < LAYERS.length - 1 ? LAYERS[i + 1] : null;

  fs.writeFileSync(path.join(DIST, `${layer.slug}.html`), page({
    slug: layer.slug,
    title: `${layer.label} — ${layer.title}`,
    body,
    rawMd,
    prev,
    next
  }));
  console.log(`Built: ${layer.slug}.html`);
});

// ── Copy stylesheet ──────────────────────────────────────────────────────────

fs.copyFileSync(path.join(__dirname, 'src', 'style.css'), path.join(DIST, 'style.css'));
console.log('Done.');
