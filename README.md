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
