# Bolão Copa 2026 — V8 corrigida

Versão corrigida para GitHub Pages com:

- visual mais próximo do Base44;
- mascotes oficiais do bolão no hero (`assets/mascotes-base44.png`);
- bandeiras locais em SVG (`assets/flags/`), sem depender de CDN externa;
- fonte interna compactada em 10px;
- motor de cálculo preservado e testado;
- recalculo automático no site público a partir de `data/resultados.json`;
- rota separada de gestão local: `gestao-resultados.html`.

## Publicação

Suba todo o conteúdo deste pacote na raiz do repositório GitHub Pages.
O arquivo `index.html` precisa ficar na raiz, junto de `app.js`, `admin.js`, `styles.css`, `data/`, `src/`, `assets/`, `scripts/` e `tests/`.

## Atualizar resultados

1. Acesse `gestao-resultados.html`.
2. Digite `GESTAO`.
3. Lance placar, classificado e status dos jogos pendentes.
4. Confira a prévia do ranking.
5. Clique em **Ver site com esta simulação** para confirmar no site público do mesmo navegador.
6. Clique em **Baixar resultados.json**.
7. No GitHub, substitua exatamente o arquivo `data/resultados.json` pelo arquivo baixado.
8. Faça commit.
9. Abra o site em janela anônima ou use Ctrl+F5.

A gestão também salva uma simulação local. Isso permite que o ranking do site público mude no seu navegador imediatamente, antes do commit no GitHub. Para ignorar a simulação local, abra `index.html?simulacao=0`.

## Testes

```bash
npm test
npm run auditar
```

Testes incluídos:

- placar exato de grupos = 5 pontos;
- vencedor/empate correto de grupos = 3 pontos;
- placar exato no mata-mata = 3 pontos, não 5;
- avanço no mata-mata;
- soma do detalhe igual ao total;
- fluxo de lançamento/exportação/importação do `resultados.json`;
- cenário real solicitado: França 2 x 0 Marrocos e Espanha 2 x 1 Bélgica alteram o ranking.
