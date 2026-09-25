#!/usr/bin/env node
/**
 * visual_recon.js
 * Le uma lista de hosts/URLs (texto simples OU JSONL do httpx), visita
 * cada um com Chromium headless, captura screenshot + titulo + headers +
 * tecnologia detectada, e gera um relatorio HTML com galeria visual.
 *
 * Uso:
 *   node visual_recon.js --input hosts.txt --output relatorio.html \
 *     [--chromium-path /usr/bin/chromium] [--concurrency 5] [--timeout 15000]
 *
 * O --input aceita:
 *   - um arquivo de texto simples, um host/URL por linha
 *   - um arquivo .jsonl de saida do httpx (do kit full_recon_pipeline),
 *     reconhecido automaticamente pela extensao .jsonl ou pelo conteudo
 */
const fs = require("fs");
const path = require("path");
const { detectTech } = require("./Tech_detect");
const { buildReport } = require("./Report");

async function loadPuppeteer() {
  const mod = await import("puppeteer-core");
  return mod.launch ? mod : mod.default;
}

function parseArgs(argv) {
  const args = { concurrency: 5, timeout: 15000, output: "relatorio.html" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i];
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--chromium-path") args.chromiumPath = argv[++i];
    else if (a === "--concurrency") args.concurrency = parseInt(argv[++i], 10);
    else if (a === "--timeout") args.timeout = parseInt(argv[++i], 10);
    else if (a === "--target") args.target = argv[++i];
  }
  return args;
}

function normalizeUrl(raw) {
  raw = raw.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  return raw;
}

/**
 * Le a lista de hosts. Se o conteudo parecer JSONL (linhas comecando com
 * "{"), extrai o campo "url"/"input" de cada linha (formato do httpx).
 * Caso contrario, trata como texto simples (um host por linha).
 */
function readHosts(inputPath) {
  const content = fs.readFileSync(inputPath, "utf-8");
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const looksJsonl = lines[0].startsWith("{");
  if (looksJsonl) {
    const urls = [];
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        const u = d.url || d.input;
        if (u) urls.push(u);
      } catch {
        // linha invalida, ignora
      }
    }
    return urls;
  }

  return lines.map(normalizeUrl).filter(Boolean);
}

async function visitHost(browser, url, timeout) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.setDefaultNavigationTimeout(timeout);

  const result = { url, ok: false };
  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout });
    result.status = resp ? resp.status() : null;
    result.finalUrl = page.url();
    result.title = await page.title();
    const headers = resp ? resp.headers() : {};
    const html = await page.content();
    const cookies = (await page.cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    result.tech = detectTech({ headers, html, title: result.title, cookies });
    result.screenshot = await page.screenshot({
      encoding: "base64",
      type: "jpeg",
      quality: 70,
    });
    result.responseTimeMs = Date.now() - start;
    result.ok = true;
  } catch (err) {
    result.error = err.message;
    result.responseTimeMs = Date.now() - start;
  } finally {
    await page.close();
  }
  return result;
}

/** Roda as visitas com um limite de concorrencia simples (pool de workers). */
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;

  async function runner() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    runner,
  );
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(
      "Uso: node visual_recon.js --input hosts.txt --output relatorio.html [--chromium-path CAMINHO]",
    );
    process.exit(1);
  }

  const chromiumPath =
    args.chromiumPath ||
    process.env.CHROMIUM_PATH ||
    [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
    ].find((p) => fs.existsSync(p));

  if (!chromiumPath) {
    console.error(
      "Nao encontrei um binario do Chromium. Instale com 'sudo apt install chromium' " +
        "ou informe o caminho com --chromium-path / variavel CHROMIUM_PATH.",
    );
    process.exit(1);
  }

  const hosts = readHosts(args.input);
  if (hosts.length === 0) {
    console.error(`Nenhum host valido encontrado em: ${args.input}`);
    process.exit(1);
  }

  console.log(
    `Alvo: ${hosts.length} hosts | concorrencia: ${args.concurrency} | chromium: ${chromiumPath}`,
  );

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  let done = 0;
  const results = await runPool(
    hosts,
    async (url) => {
      const r = await visitHost(browser, url, args.timeout);
      done++;
      const status = r.ok ? `OK (${r.status})` : `FALHOU (${r.error})`;
      console.log(`[${done}/${hosts.length}] ${url} -> ${status}`);
      return r;
    },
    args.concurrency,
  );

  await browser.close();

  const html = buildReport(results, args.target || "");
  fs.writeFileSync(args.output, html, "utf-8");

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nOK: ${ok}/${hosts.length} hosts capturados -> ${args.output}`);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
