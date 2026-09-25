# Visual Recon — Fingerprint Visual de Superfície de Ataque

![NodeJS](https://img.shields.io/badge/node.js-%236DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white)
![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![Kali](https://img.shields.io/badge/Kali-%23268BEE.svg?style=for-the-badge&logo=kalilinux&logoColor=white)

Para cada host/subdomínio de uma lista (a sua própria, ou a saída do `httpx` do kit [Full Recon Pipeline](../full-recon-pipeline)), abre a página num Chromium headless, captura **screenshot**, **título**, **status HTTP** e **tecnologia detectada** (servidor, CMS, framework front-end, ferramentas administrativas expostas), e monta uma **galeria HTML** navegável — no estilo Aquatone/gowitness.

É o complemento visual dos outros kits: eles te dizem _quais_ hosts existem, este te mostra _como cada um se parece_ e _com o que ele foi construído_, batendo o olho.

## O que tem aqui

| Arquivo           | Função                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| `Visual_recon.sh` | Wrapper: valida dependências, localiza o Chromium, chama o worker          |
| `Visual_recon.js` | Worker Node: navega, tira screenshot, detecta tecnologia, monta a lista    |
| `Tech_detect.js`  | Motor de detecção de tecnologia por assinaturas (headers + HTML)           |
| `Report.js`       | Gera o relatório HTML (galeria com busca, filtro por tecnologia, lightbox) |
| `README.md`       | Este arquivo                                                               |

---

## Requisitos

- **Kali Linux** (ou qualquer Debian-based).
- **Node.js 18+**.
- **Chromium** instalado via apt — no Kali/Debian isso é um binário real, diferente do Ubuntu recente que empacota só um stub de snap:
  ```bash
  sudo apt install chromium
  ```
  Confirme com `chromium --version` (ou `chromium-browser --version`, dependendo da distro).

---

## Instalação

```bash
mkdir -p ~/osint-toolkit/visual-recon
# copie todos os arquivos deste kit para essa pasta
cd ~/osint-toolkit/visual-recon
npm install
chmod +x Visual_recon.sh
```

---

## Uso

### Sintaxe

```bash
./Visual_recon.sh -i ARQUIVO [opcoes]
```

### Opções

| Flag           | Descrição                                                                             | Padrão         |
| -------------- | ------------------------------------------------------------------------------------- | -------------- |
| `-i ARQUIVO`   | Lista de hosts — texto simples (um por linha) **ou** JSONL do httpx (**obrigatório**) | —              |
| `-t ALVO`      | Nome do alvo, só para o título do relatório                                           | —              |
| `-o DIRETORIO` | Diretório de saída                                                                    | `./relatorios` |
| `-c N`         | Concorrência (quantas páginas em paralelo)                                            | `5`            |
| `-T MS`        | Timeout por host em milissegundos                                                     | `15000`        |
| `-p CAMINHO`   | Caminho do binário do Chromium                                                        | autodetecta    |
| `-a`           | Abre o relatório automaticamente                                                      | desativado     |
| `-h`           | Ajuda                                                                                 | —              |

### Exemplos

```bash
# Lista de hosts simples
./Visual_recon.sh -i hosts.txt

# Reaproveitando a saida do kit full_recon_pipeline.sh (httpx.jsonl)
./Visual_recon.sh -i ../full-recon-pipeline/relatorios/httpx.jsonl -t exemplo.com -a

# Mais concorrencia, timeout maior (alvos lentos)
./Visual_recon.sh -i hosts.txt -c 10 -T 25000
```

### Formato do arquivo de entrada

Texto simples, um host por linha (com ou sem esquema — `https://` é assumido se ausente):

```
www.exemplo.com
api.exemplo.com
192.0.2.10
```

Ou um `.jsonl` do `httpx` (`{"url": "...", ...}` por linha) — detectado automaticamente pelo conteúdo, não precisa indicar.

---

## O que é detectado

O motor de detecção (`Tech_detect.js`) é **assinaturas próprias**, sem depender de um banco de dados externo — inspeciona headers de resposta, HTML da página e cookies. Cobre:

- **Servidores**: nginx, Apache, IIS, Cloudflare, LiteSpeed
- **Backend**: PHP, Express, ASP.NET, Ruby on Rails, Django, Laravel
- **CMS**: WordPress, Joomla, Drupal, Magento, Shopify
- **Frontend**: React, Vue.js, Angular, Next.js, jQuery, Bootstrap, Tailwind CSS
- **Ferramentas administrativas expostas** (relevante para superfície de ataque): cPanel, phpMyAdmin, Jenkins, Grafana, Kibana, GitLab, Portainer, Swagger/OpenAPI
- **Analytics**: Google Analytics, Google Tag Manager

Para adicionar uma assinatura nova, edite o array `SIGNATURES` em `Tech_detect.js` — cada entrada é só um `{ name, test }` onde `test` recebe `{ headers, html, title, cookies }` e devolve `true`/`false`.

---

## Solução de problemas

**`Nao encontrei um Chromium instalado`**
Rode `sudo apt install chromium`, ou informe o caminho manualmente com `-p /caminho/para/chromium`.

**`Dependencias nao instaladas`**
Rode `npm install` dentro da pasta do kit antes de usar o `.sh`.

**Muitos hosts "FALHOU" com timeout**
Aumente o timeout (`-T 25000`) ou reduza a concorrência (`-c 3`) — rodar muitas páginas em paralelo numa máquina/rede mais lenta pode estourar o timeout individual.

**O relatório está muito pesado / demora pra abrir**
Cada screenshot fica embutido como base64 dentro do próprio HTML (por isso o relatório é um único arquivo, funciona offline). Para listas muito grandes (100+ hosts), isso pode gerar um arquivo grande — se for o seu caso, rode em lotes menores (`-i` com sublistas) e gere relatórios separados.

**Quero rodar contra uma lista gigante sem travar minha máquina**
Reduza `-c` (concorrência) — cada página aberta consome memória real do Chromium.

---

## Uma nota sobre como isso foi validado

**Testei de ponta a ponta com um Chromium headless real** — naveguei, tirei screenshot, detectei tecnologia e validei a interatividade do relatório gerado (busca, filtro, lightbox) com cliques reais de um navegador automatizado, contra páginas de teste com assinaturas de WordPress/React/nginx.

---

## Aviso legal e ético

Este kit visita as páginas reais dos hosts alvo (requisições HTTP/HTTPS ativas, não é coleta passiva). **Use apenas contra alvos que você tem autorização explícita para investigar.**
