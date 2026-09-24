/**
 * Monta o relatorio HTML autocontido (screenshots embutidos como base64,
 * nao ha arquivos externos) a partir dos resultados do visual_recon.js.
 */
function esc(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function buildCard(r) {
  const allTech = (r.tech || []).map((t) => esc(t)).join(",");
  if (!r.ok) {
    return `
    <div class="card card-error" data-tech="" data-host="${esc(r.url)}">
      <div class="thumb thumb-error">Falha ao carregar</div>
      <div class="card-body">
        <div class="card-title">${esc(r.url)}</div>
        <div class="card-error-msg">${esc(r.error)}</div>
      </div>
    </div>`;
  }

  const techBadges = (r.tech || [])
    .map((t) => `<span class="tech-badge">${esc(t)}</span>`)
    .join("");

  return `
    <div class="card" data-tech="${esc(allTech.toLowerCase())}" data-host="${esc((r.finalUrl || r.url).toLowerCase())}" data-status="${r.status}">
      <a href="#" class="thumb-link" data-img="shot-${esc(r.url)}">
        <img class="thumb" src="data:image/jpeg;base64,${r.screenshot}" loading="lazy" alt="${esc(r.title)}">
      </a>
      <div class="card-body">
        <div class="card-title" title="${esc(r.title)}">${esc(r.title) || "(sem titulo)"}</div>
        <div class="card-url">${esc(r.finalUrl || r.url)}</div>
        <div class="card-meta">
          <span class="status-badge status-${String(r.status || "").charAt(0)}xx">${r.status || "?"}</span>
          <span class="time-badge">${r.responseTimeMs}ms</span>
        </div>
        <div class="tech-list">${techBadges || '<span class="tech-badge tech-none">nenhuma detectada</span>'}</div>
      </div>
    </div>`;
}

function buildReport(results, target) {
  const generatedAt = new Date().toLocaleString("pt-BR");
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  const allTechSet = new Set();
  ok.forEach((r) => (r.tech || []).forEach((t) => allTechSet.add(t)));
  const techOptions = [...allTechSet]
    .sort()
    .map((t) => `<option value="${esc(t.toLowerCase())}">${esc(t)}</option>`)
    .join("");

  const cardsHtml = results.map(buildCard).join("\n");

  // Usa uma funcao de replace (nao uma string) para cada campo, porque
  // titulos/URLs raspados de paginas de terceiros podem conter sequencias
  // como "$&" ou "$1", que o String.replace trataria como padrao especial
  // se passadas diretamente como string de substituicao.
  // replaceAll (nao replace) porque alguns placeholders, como {{TARGET}},
  // aparecem mais de uma vez no template (title da aba + <h1>).
  return TEMPLATE.replaceAll(
    "{{TARGET}}",
    () => esc(target) || "Fingerprint de superficie de ataque",
  )
    .replaceAll("{{GENERATED_AT}}", () => generatedAt)
    .replaceAll("{{TOTAL}}", () => results.length)
    .replaceAll("{{OK}}", () => ok.length)
    .replaceAll("{{FAILED}}", () => failed.length)
    .replaceAll("{{TECH_COUNT}}", () => allTechSet.size)
    .replaceAll("{{TECH_OPTIONS}}", () => techOptions)
    .replaceAll("{{CARDS}}", () => cardsHtml);
}

const TEMPLATE = `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<title>Fingerprint Visual - {{TARGET}}</title>
<style>
  :root { --bg:#0f1216; --panel:#171b21; --border:#262c35; --text:#e6e9ef; --muted:#8a93a3; --accent:#4f8cff; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
  header { padding:28px 32px; border-bottom:1px solid var(--border); background:linear-gradient(135deg,#171b21,#11141a); }
  header h1 { margin:0 0 4px; font-size:22px; }
  header .meta { color:var(--muted); font-size:13px; }
  main { max-width:1400px; margin:0 auto; padding:24px 32px 64px; }
  .stats { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
  .stat { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:14px 18px; min-width:120px; flex:1; }
  .stat .num { font-size:24px; font-weight:700; }
  .stat .label { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
  .toolbar { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
  .toolbar input, .toolbar select { background:var(--panel); border:1px solid var(--border); color:var(--text); padding:9px 12px; border-radius:8px; font-size:13px; }
  .toolbar input { flex:1; min-width:220px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; }
  .card[hidden] { display:none; }
  .thumb-link { display:block; background:#000; }
  .thumb { width:100%; height:170px; object-fit:cover; object-position:top; display:block; }
  .thumb-error { width:100%; height:170px; display:flex; align-items:center; justify-content:center; background:#1a1015; color:#ff5f6d; font-size:12px; }
  .card-body { padding:12px 14px; display:flex; flex-direction:column; gap:6px; }
  .card-title { font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .card-url { color:var(--muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .card-error-msg { color:#ff5f6d; font-size:11px; }
  .card-meta { display:flex; gap:8px; align-items:center; }
  .status-badge { font-size:10px; font-weight:700; padding:2px 7px; border-radius:999px; background:#4f8cff; color:#08111f; }
  .status-4xx, .status-5xx { background:#ff7a4f; }
  .status-3xx { background:#f5d90a; }
  .time-badge { font-size:10px; color:var(--muted); }
  .tech-list { display:flex; gap:5px; flex-wrap:wrap; }
  .tech-badge { font-size:10px; background:#0c0f13; border:1px solid var(--border); padding:2px 7px; border-radius:999px; color:var(--muted); }
  .tech-none { opacity:.5; }
  #lightbox { position:fixed; inset:0; background:rgba(0,0,0,.9); display:none; align-items:center; justify-content:center; z-index:50; padding:40px; cursor:zoom-out; }
  #lightbox img { max-width:100%; max-height:100%; border-radius:8px; }
  #lightbox.open { display:flex; }
</style>
</head>
<body>

<header>
  <h1>Fingerprint Visual de Superficie de Ataque &mdash; {{TARGET}}</h1>
  <div class="meta">Gerado em {{GENERATED_AT}}</div>
</header>

<main>
  <div class="stats">
    <div class="stat"><div class="num">{{TOTAL}}</div><div class="label">Hosts</div></div>
    <div class="stat"><div class="num">{{OK}}</div><div class="label">Capturados</div></div>
    <div class="stat"><div class="num">{{FAILED}}</div><div class="label">Falharam</div></div>
    <div class="stat"><div class="num">{{TECH_COUNT}}</div><div class="label">Tecnologias distintas</div></div>
  </div>

  <div class="toolbar">
    <input type="text" id="search" placeholder="Buscar por host, titulo ou URL...">
    <select id="techFilter"><option value="">Todas as tecnologias</option>{{TECH_OPTIONS}}</select>
  </div>

  <div class="grid" id="grid">
{{CARDS}}
  </div>
</main>

<div id="lightbox"><img id="lightbox-img" src=""></div>

<script>
  const search = document.getElementById('search');
  const techFilter = document.getElementById('techFilter');
  const cards = Array.from(document.querySelectorAll('.card'));

  function applyFilters() {
    const q = search.value.toLowerCase();
    const tech = techFilter.value;
    cards.forEach(card => {
      const matchesText = !q || card.textContent.toLowerCase().includes(q);
      const matchesTech = !tech || (card.dataset.tech || '').split(',').includes(tech);
      card.hidden = !(matchesText && matchesTech);
    });
  }
  search.addEventListener('input', applyFilters);
  techFilter.addEventListener('change', applyFilters);

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  document.querySelectorAll('.thumb-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const img = link.querySelector('img');
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
    });
  });
  lightbox.addEventListener('click', () => lightbox.classList.remove('open'));
</script>

</body>
</html>
`;

module.exports = { buildReport };
