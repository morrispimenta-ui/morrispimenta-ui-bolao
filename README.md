# Bolão Copa 2026 · Valencia / Legion / PPK

Site público de conferência do Bolão da Copa 2026, pronto para GitHub Pages.

## O que este pacote entrega

- Site público responsivo, com visual inspirado no app Base44.
- Ranking geral completo e auditável.
- Palpites com filtros por participante, fase, seleção, jogo e status.
- Resultados oficiais somente leitura.
- Estatísticas por fase, seleções, campeões, artilheiros, cravadas, zebras e jogos previsíveis.
- Conferência individual com explosão da pontuação por participante.
- Regras de pontuação em cards objetivos.
- Rota administrativa separada: `gestao-resultados.html`.
- Testes automáticos do motor de cálculo.
- Auditoria de regressão do ranking.

## Segurança da área administrativa

O site é estático. Em GitHub Pages, não existe autenticação real nem gravação no servidor.

A página `gestao-resultados.html`:

- não aparece no menu público;
- exige uma trava visual simples para abrir;
- não grava resultados no GitHub;
- serve para simulação/edição local e exportação de `resultados.json`;
- exige commit manual do arquivo exportado no repositório.

Se você quiser publicar um site absolutamente sem rota administrativa, apague estes dois arquivos antes do upload:

- `gestao-resultados.html`
- `admin.js`

## Publicação no GitHub Pages

1. Crie um repositório público no GitHub.
2. Extraia este ZIP.
3. Envie o conteúdo extraído para a raiz do repositório.
4. Confirme que `index.html` está na raiz.
5. Vá em `Settings > Pages`.
6. Selecione `Deploy from a branch`.
7. Use a branch `main` e a pasta `/root`.
8. Salve e aguarde a URL pública.

## Atualização de resultados

Fluxo recomendado:

1. Abra `gestao-resultados.html` em ambiente controlado.
2. Digite `GESTAO` para liberar a interface.
3. Lance o placar e a seleção classificada, quando for mata-mata.
4. Recalcule a prévia.
5. Exporte `resultados.json`.
6. Substitua `data/resultados.json` no GitHub.
7. Faça commit.
8. O site público será atualizado pelo GitHub Pages.

## Regras preservadas

O motor de cálculo permanece em `src/engine.js`.

Pontos principais:

- Fase de grupos: placar exato = 5 pontos.
- Fase de grupos: vencedor ou empate correto = 3 pontos.
- Classificados ao mata-mata: 5 pontos por seleção correta.
- Mata-mata: confronto correto = 5 pontos.
- Mata-mata: avanço/classificado correto = 5 pontos.
- Mata-mata: placar exato = 3 pontos, não 5.
- O placar exato no mata-mata exige confronto correto e classificado correto no jogo.
- Bônus finais: campeão 70, vice 50, 3º lugar 30, 4º lugar 10, artilheiro 40.

## Testes

Execute:

```bash
npm test
```

O teste verifica:

- placar exato em grupos;
- vencedor correto em grupos;
- erro;
- placar exato no mata-mata valendo 3;
- avanço/classificado;
- soma total por participante;
- ranking ordenado sem regressão;
- fases exibidas com dados suficientes.

## Auditoria do ranking

Execute:

```bash
npm run auditar
```

Nesta versão, a auditoria registrou:

- participantes antes: 58;
- participantes depois: 58;
- divergências de ranking: 0.

As mudanças deste pacote são visuais, estatísticas, de transparência e de experiência de conferência. O motor de cálculo e os dados estruturados foram preservados.
