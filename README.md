# Bolão Copa 2026 — V18

Versão corrigida para uso com resultados via Google Planilhas.

Correções principais:

- Mantém a planilha online como fonte principal de resultados.
- Corrige o chaveamento das quartas: #97 = M89/M90, #98 = M93/M94, #99 = M91/M92, #100 = M95/M96.
- Evita que linhas futuras da planilha baguncem semifinais, 3º lugar e final.
- Na tela inicial, mostra como próximos jogos apenas a fase pendente mais próxima com confrontos definidos.
- Mantém semifinais/final disponíveis no simulador apenas quando a chave permitir.
- Preserva o motor oficial de pontuação e o bônus de placar exato no mata-mata como 3 pontos.

Publicação: envie todo o conteúdo desta pasta para a raiz do repositório GitHub Pages.


## V20
- Corrige simulador para não inventar bônus de placar exato quando o usuário escolhe apenas o classificado.
- No simulador, placar é obrigatório para jogos pendentes; sem placar o jogo não é simulado. Isso evita projeções incompletas e garante que o bônus de placar de mata-mata seja considerado quando aplicável.
- Na final, não há +5 de avanço para o campeão: confronto correto e placar exato continuam valendo, mas a colocação de campeão entra pelo bônus final.

## Auditoria V22 — Final sem ponto de avanço

Esta versão confirma a regra: na final, o vencedor não recebe +5 de avanço/classificado. O campeão recebe apenas o bônus final de campeão, quando previsto nas apostas finais.

Na final continuam valendo:
- confronto correto: +5;
- placar exato válido: +3;
- bônus de campeão: +70.

Não existe +5 adicional por “avançar” após a final, porque a competição acabou.


## V23 — Bônus de 3º e 4º colocados

Correção do motor oficial de pontuação:
- A disputa de 3º lugar, quando finalizada, passa a liberar imediatamente os bônus finais de 3º e 4º colocados.
- Exemplo validado: Inglaterra vencendo a França no jogo #103 credita +30 para quem apostou Inglaterra em 3º e +10 para quem apostou França em 4º.
- A final continua sem ponto de avanço para campeão; campeão e vice entram pelos bônus finais quando o jogo #104 terminar.
- O simulador foi ajustado para usar o mesmo motor oficial, evitando soma duplicada de bônus finais.


## V24 — Final e artilheiro auditados

Correções/prevenções:

- Confirma que, quando a final #104 terminar, campeão e vice são derivados automaticamente do jogo final.
- Mantém a regra de que a final não gera +5 de avanço para o campeão.
- Garante que o artilheiro oficial seja lido dos metadados/planilha e gere +40 para quem acertou.
- A planilha online pode informar o artilheiro oficial na aba `resultados` usando uma coluna `artilheiro_oficial` (ou `artilheiro`, `top_scorer`, `chuteira_de_ouro`). Preencha o nome em qualquer linha; recomenda-se preencher na linha do jogo #104.
- Revalida o bônus parcial de 3º/4º lugar da V23.

Para a final, lance normalmente o jogo #104 com placar, classificado/campeão e status Finalizado. Para o artilheiro, preencha exatamente o nome apostado na coluna `artilheiro_oficial`, por exemplo `Lionel Messi` ou `Kylian Mbappé`.
