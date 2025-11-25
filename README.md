## CleanX

Personal userscript (and Chrome extension) for X/Twitter that filters posts by country, region, or language with optional highlighting.

### Features
- Add or remove blocked countries, regions, and language scripts (no defaults).
- Choose filter behavior: hide or highlight matches (red border/background). Region-only accounts can be highlighted in yellow.
- Per-session and lifetime counts persisted to IndexedDB; exports available from the UI.
- Fetches profile “About” data to detect country/region and username change counts.
- Settings button in the left nav (🚫 icon) opens the modal for edits.

### Images

Sidebar Menu:

<img width="425" height="1391" alt="image" src="https://github.com/user-attachments/assets/ac24a7d2-a08c-4705-9252-bb344b3760c5" />


Settings Menu:

<img width="845" height="1476" alt="image" src="https://github.com/user-attachments/assets/b4f4780e-39a7-4c0f-a4ac-5136b41cbc34" />


Shows all user's countries in posts:

<img width="1078" height="566" alt="image" src="https://github.com/user-attachments/assets/cd3e2e41-953c-4957-9d6b-fc8ca2c27d66" />


Highlighted posts are obvious (if not blocked):

<img width="1036" height="538" alt="image" src="https://github.com/user-attachments/assets/3b16c614-75b5-4b30-bd5b-65a66701ebd1" />



### Usage
1) Userscript: download `CleanX.user.js` from Releases (or use `CleanX-user.js` in this repo) and install it in your userscript manager (Tampermonkey/Greasemonkey).  
2) Chrome extension: download `CleanX-extension.zip` from Releases and load as an unpacked extension in `chrome://extensions` (Developer Mode), or load the `extension/` folder directly.  
3) Open X/Twitter and click the 🚫 CleanX button under Profile in the left nav.  
4) Add countries/regions/languages; toggle block vs highlight and region-only highlight.  
5) Reload to apply; use Export DB for debugging or backup.

### Development Notes
- No build step; edit `CleanX-user.js` directly.
- Optional format: `npx prettier --check "CleanX-user.js"`.
- Primary storage: `localStorage` + IndexedDB (`known` store for users, `stats` for totals).
- Extension entrypoint: `extension/content.js`, manifest at `extension/manifest.json`.
- CI: pushes to `main`/`master` build artifacts (userscript, zipped extension, changelog) as workflow artifacts. Tagging `v*` publishes a GitHub Release with those files attached and the changelog as the release body.


## ======================================================

## CleanX - PT-BR

Script de usuário pessoal (e extensão do Chrome) para X/Twitter que filtra publicações por país, região ou idioma, com destaque opcional.

### Recursos
- Adicione ou remova scripts de países, regiões e idiomas bloqueados (sem valores padrão).

- Escolha o comportamento do filtro: oculte ou destaque as correspondências (borda/fundo vermelho). Contas com restrição de região podem ser destacadas em amarelo.

- Contagens por sessão e totais persistidas no IndexedDB; exportações disponíveis na interface do usuário.

- Busca dados da seção "Sobre" do perfil para detectar alterações de país/região e nome de usuário.

- O botão de configurações na barra de navegação à esquerda (ícone 🚫) abre o modal para edições.

- ### Imagens

Menu da barra lateral:

<img width="425" height="1391" alt="image" src="https://github.com/user-attachments/assets/ac24a7d2-a08c-4705-9252-bb344b3760c5" />

Menu de configurações:

<img width="845" height="1476" alt="image" src="https://github.com/user-attachments/assets/b4f4780e-39a7-4c0f-a4ac-5136b41cbc34" />

Mostra todos os países do usuário nas postagens:

<img width="1078" height="566" alt="image" src="https://github.com/user-attachments/assets/cd3e2e41-953c-4957-9d6b-fc8ca2c27d66" />

As postagens destacadas são óbvias (se não estiverem bloqueadas):

<img width="1036" height="538" alt="image" src="https://github.com/user-attachments/assets/3b16c614-75b5-4b30-bd5b-65a66701ebd1" />

### Uso
1) Userscript: baixe `CleanX.user.js` da seção Releases (ou use `CleanX-user.js` neste repositório) e instale-o no seu gerenciador de userscripts (Tampermonkey/Greasemonkey).

2) Extensão do Chrome: baixe o arquivo `CleanX-extension.zip` da seção Releases e carregue-o como uma extensão descompactada em `chrome://extensions` (Modo Desenvolvedor) ou carregue a pasta `extension/` diretamente.

3) Abra o X/Twitter e clique no botão 🚫 CleanX em Perfil, na barra de navegação à esquerda.

4) Adicione países/regiões/idiomas; ative a exibição em bloco versus destaque e destaque apenas da região.

5) Recarregue a página para aplicar as alterações; use a opção Exportar Banco de Dados para depuração ou backup.

### Notas de Desenvolvimento
- Sem etapa de compilação; edite o arquivo `CleanX-user.js` diretamente.

- Formato opcional: `npx prettier --check "CleanX-user.js"`.

- Armazenamento principal: `localStorage` + IndexedDB (armazenamento `known` para usuários, `stats` para totais).

- Ponto de entrada da extensão: `extension/content.js`, manifesto em `extension/manifest.json`.
- CI: envia para `main`/`master` os artefatos de compilação (script do usuário, extensão compactada, changelog) como artefatos de fluxo de trabalho. A marcação `v*` publica uma versão no GitHub com esses arquivos anexados e o changelog como corpo da versão.
