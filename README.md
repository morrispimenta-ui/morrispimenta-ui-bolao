# Bolão Copa 2026 — GitHub Pages V12

Versão pública de conferência do Bolão Copa 2026, com visual inspirado no Base44 e telas mais leves para os participantes.

## O que mudou na V12

- Retirada da tela pública de mensagens administrativas/técnicas.
- Página inicial ficou mais amigável para apostadores, mantendo apenas data/hora da última atualização.
- Ranking e Palpites seguem em cards expansíveis: o essencial aparece primeiro e o detalhe abre sob demanda.
- Estatísticas seguem organizadas nas seções Geral do Bolão, Análise de Jogos, Highlights e Palpites Finais.
- Mantido o cálculo validado, sem alteração regressiva de pontuação.

## Como publicar

Suba todo o conteúdo desta pasta na raiz do repositório GitHub Pages. O arquivo `index.html` deve ficar na raiz.

## Como atualizar resultados

A área de lançamento continua disponível em `gestao-resultados.html`, fora do menu público. Depois de exportar o novo `resultados.json`, substitua o arquivo `data/resultados.json` no repositório.

## Testes executados

```bash
npm test
npm run auditar
```

Resultado na base atual:

- 58 participantes válidos.
- 0 divergências de ranking após auditoria.
- Placar exato no mata-mata permanece valendo 3 pontos.
