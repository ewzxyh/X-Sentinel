### X-Sentinel - PT-BR

Userscript e extensão para X/Twitter que filtra publicações por país, região ou idioma, oferecendo opções de destaque visual.
### Recursos
- **Gerenciamento de Filtros:** Adicione ou remova países, regiões e idiomas da lista de bloqueio (inicia sem padrões predefinidos).
- **Comportamento Flexível:** Escolha entre ocultar ou destacar as correspondências (borda/fundo vermelho). Contas com restrição de região podem ser destacadas em amarelo.
- **Persistência de Dados:** Contagens por sessão e totais históricos são salvos no IndexedDB; função de exportação disponível na interface.
- **Detecção Inteligente:** Monitora a seção "Sobre" do perfil para identificar alterações de país/região e nome de usuário.
- **Acesso Fácil:** O botão de configurações (ícone 🚫) na barra de navegação lateral abre o painel de edições.
- 
### Imagens:

### Menu da barra lateral:

<img width="292" height="834" alt="image" src="https://github.com/user-attachments/assets/b6b3f009-c20d-4b2a-bc66-2bb86baa539f" />

### Menu de configurações:

<img width="684" height="741" alt="image" src="https://github.com/user-attachments/assets/85b074e2-5078-4df0-b785-a01e7c2b4d7f" />

### Exibição de países nas postagens:

<img width="601" height="280" alt="image" src="https://github.com/user-attachments/assets/dff19c3f-ee5a-4e8b-b6b6-5cc248636a81" />

### Uso

1) **Userscript:** Baixe `X-Sentinel.user.js` da seção Releases (ou use `X-Sentinel-user.js` deste repositório) e instale-o no seu gerenciador de userscripts (Tampermonkey/Greasemonkey).
2) **Extensão do Chrome:** Baixe o arquivo `X-Sentinel-extension.zip` da seção Releases. Em `chrome://extensions` (ative o Modo Desenvolvedor), carregue-o como uma extensão descompactada ou carregue a pasta `extension/` diretamente.
3) **Acesso:** Abra o X/Twitter e clique no botão **🚫 X-Sentinel** na barra de navegação lateral.
4) **Configuração:** Adicione países/regiões/idiomas; alterne entre o modo de ocultação ou destaque visual.
5) **Aplicação:** Recarregue a página para aplicar as alterações; utilize a opção "Exportar Banco de Dados" para backups ou depuração.

### Notas de Desenvolvimento

- **Zero Build:** Não há etapa de compilação; edite o arquivo `X-Sentinel-user.js` diretamente.
- **Formatação (Opcional):** `npx prettier --check "X-Sentinel-user.js"`.
- **Armazenamento:** Utiliza `localStorage` + IndexedDB (store `known` para usuários, `stats` para totais).
- **Extensão:** Ponto de entrada em `extension/content.js`, manifesto em `extension/manifest.json`.
- **CI/CD:** Pushes na branch `main`/`master` geram artefatos de build (userscript, extensão zipada, changelog). Tags `v*` publicam automaticamente uma Release no GitHub com estes arquivos e o changelog.
