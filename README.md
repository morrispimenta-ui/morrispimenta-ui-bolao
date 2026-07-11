# Bolão Copa 2026 · Valencia / Legion / PPK — V13

Versão pública para GitHub Pages com visual limpo, conferência auditável e nova aba **Simulador**.

## O que há nesta versão

- Ranking oficial preservado.
- Palpites e conferência em cards expansíveis.
- Resultados oficiais somente leitura.
- Estatísticas em seções no padrão Base44.
- Gestão de resultados em rota separada (`gestao-resultados.html`), fora do menu público.
- Nova aba pública **Simulador**:
  - simula apenas confrontos pendentes;
  - mostra ranking simulado no topo;
  - monta chave à esquerda;
  - mostra campeão, vice, terceiro, quarto e artilheiro à direita;
  - não altera `data/resultados.json`;
  - não altera ranking oficial;
  - funciona apenas na sessão do usuário.

## Publicação no GitHub Pages

Suba todo o conteúdo desta pasta na raiz do repositório. O arquivo `index.html` deve ficar na raiz.

## Atualização oficial dos resultados

A página pública usa apenas `data/resultados.json` como fonte oficial. A área de gestão gera novo JSON para substituição manual desse arquivo no GitHub.

## Testes

```bash
npm test
npm run auditar
```

Os testes incluem regras oficiais, regressão do ranking e isolamento do simulador.
