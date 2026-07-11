# Bolão Copa 2026 — V10 GitHub Pages

Versão corrigida para publicação pública no GitHub Pages.

## Principais correções da V10

- Página **Palpites** redesenhada em cards, com mais espaçamento e sem encavalamento.
- Página **Estatísticas** reorganizada no padrão do Base44:
  - Geral do Bolão
  - Análise de Jogos
  - Highlights
  - Palpites Finais
- O site público passa a ler e comparar corretamente `data/resultados.json`, inclusive quando o arquivo exportado contém `metadata`.
- A data de última atualização passa a vir do `metadata.updated_at` do `resultados.json` exportado.
- A gestão exporta `resultados.json` no formato:

```json
{
  "metadata": { "updated_at": "...", "played_count": 98 },
  "resultados": []
}
```

- A base deste pacote já inclui os resultados:
  - #97 França 2 x 0 Marrocos — França classificada
  - #98 Espanha 2 x 1 Bélgica — Espanha classificada

## Como publicar

Suba todo o conteúdo desta pasta na raiz do repositório GitHub Pages. O arquivo `index.html` deve ficar na raiz.

## Como atualizar resultados no futuro

1. Abra `gestao-resultados.html`.
2. Digite `GESTAO`.
3. Lance o placar e, no mata-mata, o classificado.
4. Confira a prévia do ranking.
5. Clique em **Baixar resultados.json** ou **Copiar JSON**.
6. No GitHub, substitua o conteúdo de `data/resultados.json`.
7. Faça commit e abra o site em janela anônima/Ctrl+F5.

## Testes

Executado com sucesso:

```bash
npm test
npm run auditar
```
