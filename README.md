# Bolão Copa 2026 — Atualização V14

Versão pública para GitHub Pages com:

- Estatísticas separando cravadas de grupos, cravadas de mata-mata e cravadas totais estatísticas.
- Placar exato no mata-mata preservado como bônus de 3 pontos, sem alterar o ranking oficial.
- Aba Palpites reorganizada em cards expansíveis por apostador, com detalhes por fase apenas ao clicar.
- Sumário final do apostador com campeão, vice, terceiro, quarto e artilheiro.
- Simulador preservado como funcionalidade recreativa/local, sem alterar resultados oficiais.

## Publicação

Suba todo o conteúdo deste pacote na raiz do repositório GitHub Pages, substituindo os arquivos atuais.
O arquivo `index.html` deve ficar na raiz do repositório.

## Testes executados

```bash
npm test
npm run auditar
```

Resultado esperado: 58 participantes, 0 divergências de ranking e placar exato do mata-mata valendo 3 pontos.
