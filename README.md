# Bolão Copa 2026 · GitHub público V2

Pacote público para GitHub Pages, sem página administrativa exposta.

## O que mudou nesta versão

- Interface refeita para ficar mais próxima da experiência do app original do Base44: menu lateral, menu mobile, cards, badges, cores esportivas e navegação por abas.
- Bandeiras exibidas como imagens via FlagCDN, com fallback por emoji/texto caso a imagem não carregue.
- Ranking geral com blocos de colunas por síntese, fases e apostas finais.
- Detalhamento explosível do participante com prova da soma.
- Aba de cravadas com lista nominal dos jogos cravados por participante.
- Palpites com filtros por participante, seleção, fase, jogo e status.
- Resultados oficiais somente leitura.
- Estatísticas por fase, seleções apostadas, apostas finais, artilheiro, cravadas, zebras e jogos previsíveis.
- Auditoria interna no front-end para conferir total por participante, cravadas, pontuações inválidas e mata-mata sem classificado.

## Cálculo

O motor de cálculo foi preservado em `src/engine.js`.

Regra crítica preservada:

- Placar exato no mata-mata vale **3 pontos**, não 5.
- O bônus de placar exato no mata-mata exige confronto correto e classificado correto no jogo.
- A Suíça permanece como classificada no jogo #96, conforme dados atuais.

## Segurança

Este pacote não contém `admin.html`, `admin.js`, `gestao-resultados.html` ou auditoria privada com e-mails. É apenas o site público de conferência.

Para atualizar resultados, use a ferramenta administrativa local/privada e suba somente o novo `data/resultados.json` validado.

## Publicação no GitHub Pages

Envie o conteúdo desta pasta para a raiz do repositório público. O arquivo `index.html` deve ficar na raiz.

Depois, em Settings > Pages, publique a branch `main` a partir de `/root`.

## Testes

```bash
npm test
```

Os testes verificam regras básicas do motor, inclusive placar exato no mata-mata valendo 3 pontos.
