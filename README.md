# Bolão Copa 2026 — GitHub Pages V6

Pacote público completo para subir na raiz do repositório do GitHub Pages.

## O que mudou nesta versão

- Ajuste visual forte inspirado no padrão do app Base44: hero escuro, cards arredondados, menu lateral, badges, sombras suaves e layout mais limpo.
- Inclusão dos mascotes do bolão em `assets/mascotes-bolao.svg`.
- Bandeiras passam a usar imagens do FlagCDN como fonte principal, pois emojis de bandeira não aparecem corretamente em muitos navegadores no Windows.
- Fallback textual por sigla caso alguma bandeira não carregue.
- Correções de responsividade para evitar caixas truncadas, principalmente em cards, ranking, resultados, estatísticas e modal de conferência.
- Mantidos `gestao-resultados.html` e `admin.js` para lançamento local/simulado dos próximos resultados, sem link no menu público.
- Motor de cálculo preservado.

## Como publicar

Suba todo o conteúdo desta pasta na raiz do repositório. O arquivo `index.html` precisa ficar na raiz, junto com `app.js`, `styles.css`, `data/`, `src/`, `scripts/`, `tests/` e `assets/`.

## Gestão de resultados

A gestão não aparece no menu público. Acesse diretamente:

`/gestao-resultados.html`

Digite `GESTAO`, lance os resultados, confira a prévia e exporte o novo `resultados.json`. Depois substitua `data/resultados.json` no GitHub e faça commit.

## Testes

Foram executados:

```bash
npm test
node scripts/auditar.js
```

Resultado da auditoria: 58 participantes antes, 58 depois, 0 divergências de ranking.
