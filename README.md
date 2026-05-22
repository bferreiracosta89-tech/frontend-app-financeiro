# Parte 5 — Pagamentos mensais (patch mobile)

Aplique por cima do projeto da Parte 1 + Parte 4. Os arquivos NOVOS são adicionados; os SUBSTITUTOS sobrescrevem os existentes.

## Como aplicar

```bash
cd controle-restauracao-financeira
cp -r ../mobile-parte5/src/* src/
cp ../mobile-parte5/App.tsx ./
npx expo start --clear
```

## O que mudou

**Novos arquivos:**
- `src/services/payments.ts` — API + helpers
- `src/components/PaymentModal.tsx` — modal genérico p/ PARCELA, AMORTIZACAO, LIQUIDACAO, NAO_PAGO, PARCIAL
- `src/screens/MonthlyMatrixScreen.tsx` — tela mês-a-mês (matriz credor × mês)
- `src/db/payments_migration.ts` — adiciona tabela `payments` ao SQLite local

**Substituições:**
- `src/db/database.ts` — chama nova migration
- `src/store/useStore.ts` — adiciona `payments[]`, `createPayment`, `deletePayment`, `loadPayments`
- `src/screens/DebtsScreen.tsx` — botões "Pagar parcela / Amortizar / Liquidar / Marcar não pago" em cada dívida
- `src/services/sync.ts` — inclui `payments` no push/pull
- `App.tsx` — adiciona aba "Mês a Mês"

## Lógica de abate automático

Quando um pagamento é registrado, o saldo da dívida é ajustado:
- PARCELA → abate valor + parcelas pagas +1
- AMORTIZACAO/PARCIAL → abate valor (não conta como parcela)
- LIQUIDACAO → zera saldo, status=QUITADO
- NAO_PAGO → só histórico, não altera saldo

A exclusão reverte automaticamente.
