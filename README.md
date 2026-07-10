# Bolão Copa 2026 · Conferência pública V7

Pacote completo para GitHub Pages.

## O que mudou na V7

- Fonte interna compactada para 10px em tabelas, cards de detalhe e caixas internas, reduzindo textos encavalados.
- Motor de cálculo revisado e testado com regressão completa.
- A coluna **Cravadas** agora conta apenas placares exatos da fase de grupos, preservando a forma exibida no relatório original. Placar exato no mata-mata segue valendo **3 pontos** e aparece como **bônus de placar no mata-mata**, sem inflar a coluna de cravadas.
- A gestão de resultados foi corrigida para não depender de cache/localStorage antigo.
- O site público só usa simulação local quando aberto com `?simulacao=1`.
- A página `gestao-resultados.html` permite baixar ou copiar o `resultados.json` pronto para substituir no GitHub.
- Teste end-to-end simula lançamento do jogo #97, exporta/importa `resultados.json` e confirma que o ranking após publicação bate com a prévia.

## Publicação

Suba todo o conteúdo desta pasta na raiz do repositório do GitHub Pages. O arquivo `index.html` deve ficar na raiz.

## Gestão de resultados

A área de gestão não aparece no menu público. Acesse diretamente:

`/gestao-resultados.html`

Digite `GESTAO`, lance o resultado, confira a prévia, e use uma destas opções:

1. **Baixar resultados.json**: baixe o arquivo e substitua `data/resultados.json` no GitHub.
2. **Copiar JSON**: copie o conteúdo e cole diretamente no editor do arquivo `data/resultados.json` no GitHub.

Depois de substituir o arquivo, clique em **Commit changes**. O site público recalcula tudo a partir do JSON publicado.

## Testes

```bash
npm test
npm run auditar
```

Resultado esperado:

- 58 participantes válidos.
- 0 divergências de ranking na base publicada.
- Placar exato no mata-mata = 3 pontos.
- Cravadas = placares exatos de grupos.
- Substituição de `resultados.json` validada por teste.
