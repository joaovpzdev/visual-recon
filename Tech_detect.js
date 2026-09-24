/**
 * Deteccao de tecnologia por assinaturas, no estilo Wappalyzer/BuiltWith,
 * mas simples e auto-contida (sem depender de um banco de dados externo
 * que precisaria ser baixado/atualizado).
 *
 * Cada assinatura testa contra: headers de resposta, HTML do corpo, e
 * cookies. Uma pagina pode bater com varias assinaturas ao mesmo tempo
 * (ex: nginx + WordPress + jQuery), o que e o comportamento esperado.
 */

const SIGNATURES = [
  // --- Servidores web ---
  { name: "nginx", test: ({ headers }) => /nginx/i.test(headers.server || "") },
  {
    name: "Apache",
    test: ({ headers }) => /apache/i.test(headers.server || ""),
  },
  {
    name: "Microsoft IIS",
    test: ({ headers }) => /iis/i.test(headers.server || ""),
  },
  {
    name: "Cloudflare",
    test: ({ headers }) =>
      /cloudflare/i.test(headers.server || "") || headers["cf-ray"],
  },
  {
    name: "LiteSpeed",
    test: ({ headers }) => /litespeed/i.test(headers.server || ""),
  },

  // --- Linguagens / frameworks de backend ---
  {
    name: "PHP",
    test: ({ headers }) => /php/i.test(headers["x-powered-by"] || ""),
  },
  {
    name: "Express",
    test: ({ headers }) => /express/i.test(headers["x-powered-by"] || ""),
  },
  {
    name: "ASP.NET",
    test: ({ headers }) =>
      /asp\.net/i.test(headers["x-powered-by"] || "") ||
      headers["x-aspnet-version"],
  },
  {
    name: "Ruby on Rails",
    test: ({ headers, html }) =>
      /rails/i.test(headers["x-powered-by"] || "") ||
      /csrf-param.*authenticity_token/i.test(html),
  },
  {
    name: "Django",
    test: ({ headers, html }) =>
      headers["x-frame-options"] && /csrfmiddlewaretoken/i.test(html),
  },
  {
    name: "Laravel",
    test: ({ html, cookies }) =>
      /laravel_session/i.test(cookies || "") || /Laravel/i.test(html),
  },

  // --- CMS ---
  {
    name: "WordPress",
    test: ({ html }) =>
      /wp-content|wp-includes|generator[^>]*wordpress/i.test(html),
  },
  {
    name: "Joomla",
    test: ({ html }) => /generator[^>]*joomla|\/media\/jui\//i.test(html),
  },
  {
    name: "Drupal",
    test: ({ html, headers }) =>
      /generator[^>]*drupal/i.test(html) ||
      /drupal/i.test(headers["x-generator"] || ""),
  },
  {
    name: "Magento",
    test: ({ html }) => /Mage\.Cookies|\/static\/frontend\//i.test(html),
  },
  {
    name: "Shopify",
    test: ({ html, headers }) =>
      /cdn\.shopify\.com/i.test(html) ||
      /shopify/i.test(headers["x-shopid"] ? "shopify" : ""),
  },

  // --- Frontend frameworks ---
  {
    name: "React",
    test: ({ html }) =>
      /react-dom|__REACT_DEVTOOLS_GLOBAL_HOOK__|data-reactroot/i.test(html),
  },
  {
    name: "Vue.js",
    test: ({ html }) => /__VUE__|data-v-app|vue\.runtime/i.test(html),
  },
  {
    name: "Angular",
    test: ({ html }) => /ng-version|ng-app|angular\.js/i.test(html),
  },
  {
    name: "Next.js",
    test: ({ html }) => /__NEXT_DATA__|_next\/static/i.test(html),
  },
  { name: "jQuery", test: ({ html }) => /jquery(\.min)?\.js/i.test(html) },
  {
    name: "Bootstrap",
    test: ({ html }) =>
      /bootstrap(\.min)?\.css|class="[^"]*\bcontainer-fluid\b/i.test(html),
  },
  {
    name: "Tailwind CSS",
    test: ({ html }) =>
      /tailwind(\.min)?\.css|class="[^"]*\b(flex|grid)\b[^"]*\btext-/i.test(
        html,
      ),
  },

  // --- Infra / ferramentas administrativas (relevante para superficie de ataque) ---
  {
    name: "cPanel",
    test: ({ html, title }) =>
      /cpanel/i.test(title || "") || /cpanel/i.test(html),
  },
  {
    name: "phpMyAdmin",
    test: ({ html, title }) => /phpmyadmin/i.test(title || ""),
  },
  {
    name: "Jenkins",
    test: ({ html, headers }) =>
      /jenkins/i.test(headers["x-jenkins"] ? "jenkins" : "") ||
      /Dashboard \[Jenkins\]/i.test(html),
  },
  { name: "Grafana", test: ({ html }) => /grafana/i.test(html) },
  { name: "Kibana", test: ({ html }) => /kibana/i.test(html) },
  { name: "GitLab", test: ({ html }) => /gitlab/i.test(html) },
  {
    name: "Portainer",
    test: ({ html, title }) => /portainer/i.test(title || ""),
  },
  {
    name: "Swagger / OpenAPI",
    test: ({ html }) => /swagger-ui|openapi\.json/i.test(html),
  },

  // --- Analytics / terceiros (util pra footprint, nao so seguranca) ---
  {
    name: "Google Analytics",
    test: ({ html }) =>
      /google-analytics\.com\/analytics\.js|gtag\(/i.test(html),
  },
  {
    name: "Google Tag Manager",
    test: ({ html }) => /googletagmanager\.com/i.test(html),
  },
];

/**
 * Roda todas as assinaturas contra os dados coletados de uma pagina.
 * @param {{headers: Object, html: string, title: string, cookies: string}} page
 * @returns {string[]} lista de nomes de tecnologia detectados
 */
function detectTech(page) {
  const headers = Object.fromEntries(
    Object.entries(page.headers || {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const ctx = {
    headers,
    html: page.html || "",
    title: page.title || "",
    cookies: page.cookies || "",
  };

  const found = [];
  for (const sig of SIGNATURES) {
    try {
      if (sig.test(ctx)) found.push(sig.name);
    } catch {
      // assinatura mal formada nao deve derrubar o resto da deteccao
    }
  }
  return found;
}

module.exports = { detectTech, SIGNATURES };
