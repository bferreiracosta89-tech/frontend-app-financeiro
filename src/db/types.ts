export type DebtStatus = 'PAGAR' | 'NEGOCIAR' | 'PAUSADO' | 'QUITADO';
export type Priority = 'ALTA' | 'MEDIA' | 'BAIXA';
export type NegotiationChannel = 'Telefone' | 'WhatsApp' | 'App' | 'Agência' | 'E-mail';
export type LegalLocation = 'Defensoria Pública' | 'PROCON' | 'Juizado';
export type AccountKind = 'CONTA_CORRENTE' | 'CARTAO_CREDITO';
export type PaymentMethod = 'Dinheiro' | 'Pix' | 'Débito' | 'Crédito' | 'Boleto' | 'Outro';

export interface Income {
  bruto: number; liquido: number;
  fontePagadora: string; banco: string;
  dataRecebimento: string; observacao: string;
}

export interface MinExistencial {
  alimentacao: number; transporte: number; agua: number; energia: number;
  internet: number; saude: number; outros: number; reserva: number;
}

export interface Debt {
  id?: number;
  credor: string; tipo: string; total: number; parcela: number;
  vencimento: string; status: DebtStatus; prioridade: Priority;
  garantia: boolean; observacao: string;
  numeroContrato: string; valorTotal: number; taxaJuros: number;
  qtdParcelas: number; parcelasPagas: number;
  statusAnterior?: string | null;
  totalAnterior?: number | null; valorTotalAnterior?: number | null;
  parcelaAnterior?: number | null; qtdParcelasAnterior?: number | null; parcelasPagasAnterior?: number | null;
}

export interface CardPurchase {
  id?: number; debtId: number;
  descricao: string; estabelecimento: string; dataCompra: string;
  valorTotal: number; qtdParcelas: number; parcelasPagas: number;
  valorParcela: number; primeiraParcela: string; observacao: string;
}

export interface Expense {
  id?: number;
  data: string;          // AAAA-MM-DD
  descricao: string;
  categoria: string;     // 'Alimentação' | 'Transporte' | 'Lazer' | 'Saúde' | 'Casa' | 'Outros' (livre)
  valor: number;
  formaPagamento: PaymentMethod;
  accountId: number | null;   // cartão ou conta usada
  parcelado: boolean;
  qtdParcelas: number;        // se parcelado
  cardPurchaseId: number | null; // se virou uma compra parcelada no cartão
  observacao: string;
}

export interface Account {
  id?: number;
  nome: string;            // "Nubank", "Itaú Conta", etc.
  tipo: AccountKind;
  limiteTotal: number;     // limite de crédito (cartão) ou cheque especial (conta)
  diaFechamento: number;   // só faz sentido pra cartão (1..28)
  diaVencimento: number;   // dia da fatura ou dia do débito automático
  observacao: string;
}

export interface Negotiation {
  id?: number;
  credor: string; data: string; canal: NegotiationChannel;
  resposta: string; proposta: string; novaParcela: number;
  valorOriginal?: number; valorAcordado?: number; qtdParcelas?: number; parcelasPagas?: number; debtId?: number | null;
  prazo: string; aceito: boolean; proximaAcao: string;
}

export interface LegalPlan {
  protocolado: boolean; local: LegalLocation; dataProtocolo: string;
  numero: string; dataAudiencia: string; status: string; observacao: string;
}

export interface Reminder {
  id?: number;
  debtId: number | null;
  titulo: string;
  diaDoMes: number;
  ativo: boolean;
  notificationId: string;
}
