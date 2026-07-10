# Bolão Copa 2026 · Base44 Transparente V3

Versão pública de conferência do Bolão da Copa 2026 para GitHub Pages.

## O que mudou na V3

- Bandeiras agora usam emoji como fonte principal, sem depender de CDN externa. Isso evita que elas desapareçam no GitHub Pages.
- Reintroduzida a área separada `gestao-resultados.html` para lançamento local dos próximos resultados.
- A área de gestão não aparece no menu público.
- A gestão permite editar placar, classificado no mata-mata, validar inconsistências, recalcular prévia e exportar `resultados.json`.
- A evolução do bolão agora é calculada automaticamente por marcos da competição: 1ª rodada dos grupos, 2ª rodada, fim dos grupos, 1/16 avos e oitavas.
- A tela de cravadas foi reforçada para mostrar jogo, palpite, resultado real, motivo e pontos.
- O motor de cálculo foi preservado.

## Publicação no GitHub Pages

Suba todos os arquivos deste pacote para a raiz do repositório.

O arquivo `index.html` precisa ficar na raiz.

## Lançamento de novos resultados

Acesse diretamente:

`https://SEU-USUARIO.github.io/SEU-REPOSITORIO/gestao-resultados.html`

Digite `GESTAO` para abrir a edição local.

Fluxo:

1. Lance placar e classificado, quando for mata-mata.
2. Recalcule a prévia.
3. Confira impacto no ranking.
4. Exporte `resultados.json`.
5. No GitHub, substitua `data/resultados.json` pelo arquivo exportado.
6. Aguarde o GitHub Pages atualizar o site público.

## Aviso de segurança

GitHub Pages é estático. A página `gestao-resultados.html` não grava dados no servidor e não tem segurança real por senha. Ela serve como ferramenta local/de bastidor para gerar o JSON. Não coloque link para ela no menu público e não publique dados privados.

## Testes

Para testar localmente com Node:

```bash
npm test
```

O teste garante, entre outros pontos, que placar exato no mata-mata vale 3 pontos, não 5.
