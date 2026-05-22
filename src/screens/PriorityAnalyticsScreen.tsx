import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Card, ScreenScroll, Section, Stat } from '../components/UI';
import { COLORS } from '../utils/theme';
import { fmtBRL } from '../utils/format';
import { getDb } from '../db/database';

export default function PriorityAnalyticsScreen() {
  const [data, setData] = useState({ dividas: 0, acordos: 0, judicial: 0, pagos: 0, economia: 0 });
  useEffect(() => { (async () => {
    const db = await getDb();
    const debts = await db.getAllAsync('SELECT * FROM debts WHERE deleted_at IS NULL') as any[];
    const agreements = await db.getAllAsync('SELECT * FROM agreements WHERE deleted_at IS NULL') as any[];
    const legal = await db.getAllAsync('SELECT * FROM legal_agreements WHERE deleted_at IS NULL') as any[];
    const payments = await db.getAllAsync('SELECT * FROM payments WHERE deleted_at IS NULL') as any[];
    setData({
      dividas: debts.reduce((a,d)=>a+Number(d.total||d.valor_total||0),0),
      acordos: agreements.reduce((a,d)=>a+Number(d.nova_parcela||0),0),
      judicial: legal.reduce((a,d)=>a+Number(d.parcela_judicial||0),0),
      pagos: payments.reduce((a,p)=>a+Number(p.valor_pago||p.valor||0),0),
      economia: agreements.reduce((a,d)=>a+Number(d.desconto||0),0),
    });
  })().catch(()=>{}); }, []);
  return <ScreenScroll>
    <Section title="Analytics financeiro"><Card><Text style={{color:COLORS.muted,lineHeight:20}}>Leitura executiva dos impactos de acordos, judicialização, pagamentos e economia acumulada.</Text></Card></Section>
    <Section title="Indicadores"><Card style={{flexDirection:'row', flexWrap:'wrap'}}>
      <Stat label="Dívida atual" value={fmtBRL(data.dividas)} color={COLORS.danger}/>
      <Stat label="Acordos/mês" value={fmtBRL(data.acordos)} color={COLORS.info}/>
      <Stat label="Judicial/mês" value={fmtBRL(data.judicial)} color={COLORS.warning}/>
      <Stat label="Pago acumulado" value={fmtBRL(data.pagos)} color={COLORS.success}/>
      <Stat label="Economia em acordos" value={fmtBRL(data.economia)} color={COLORS.success}/>
    </Card></Section>
    <Section title="Base IA"><Card><Text style={{color:COLORS.text,lineHeight:20}}>Próxima camada: usar estes indicadores para recomendações automáticas de renegociação, risco de inadimplência, elegibilidade de repactuação e geração de relatório jurídico.</Text></Card></Section>
  </ScreenScroll>;
}
