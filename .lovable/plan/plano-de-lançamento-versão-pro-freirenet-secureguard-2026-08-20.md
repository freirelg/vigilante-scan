# Plano de Lançamento: Versão Pro (Freirenet-SecureGuard)

Este plano descreve as alterações necessárias para implementar o fluxo de pagamento via PIX (R$ 1,99) para desbloqueio da versão PRO, mantendo a identidade visual e as restrições de acesso solicitadas.

## Alterações Propostas

### 1. Sistema de Edição e Níveis (edition.ts)
- Adicionar um novo nível de acesso: `Nível 3 (PRO/PIX)`.
- Nível 0: 30 scans, menus Análise e Histórico.
- Nível 1 (FreireNet50): 50 scans, + menu Intrusão.
- Nível 2 (FreireNetLivre999): Acesso ilimitado total.
- **Novo Fluxo:** Botão de compra PIX que, após confirmação (simulada ou real), desbloqueia o Nível 2 permanentemente.

### 2. Interface de Upgrade (UpgradeBlock.tsx)
- Adicionar uma seção de "Pagamento Único".
- Exibir o valor de **R$ 1,99**.
- Gerar um QR Code PIX (simulado para o build atual, preparado para integração real).
- Botão "Pagar com PIX".
- Manter o campo de senha para códigos manuais (`FreireNet50`, `FreireNetLivre999`).

### 3. Detalhes Técnicos (Backend/Local)
- Persistência do status "Pago" no `localStorage` (versão v2 para resetar usuários antigos).
- Mensagens personalizadas: "Desbloqueie agora por apenas R$ 1,99 via PIX".

## Aspectos Visuais
- Ícone de PIX e cores oficiais do Banco Central para o botão de pagamento.
- Feedback visual de "Aguardando pagamento" com loader profissional.
- Tela de sucesso após o pagamento liberando todos os recursos.

---
*Você é o desenvolvedor oficial deste projeto. Nenhuma modificação visual não solicitada será feita.*
