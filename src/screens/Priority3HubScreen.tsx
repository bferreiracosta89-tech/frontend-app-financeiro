import React from 'react';
import { Text, View } from 'react-native';
import { Card, ScreenScroll, Section, Button } from '../components/UI';
import { COLORS } from '../utils/theme';

export default function Priority3HubScreen({ navigation }: any) {
  return (
    <ScreenScroll>
      <Section title="Recuperação avançada">
        <Card>
          <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text }}>Acordos, judicialização e IRPF</Text>
          <Text style={{ color: COLORS.muted, marginTop: 6, lineHeight: 20 }}>
            Módulos estratégicos para renegociação de dívidas, acordos homologados, relatórios para imposto de renda e analytics financeiro.
          </Text>
        </Card>
      </Section>

      <Section title="Módulos">
        <Card>
          <Button title="Acordos e renegociações por dívida" onPress={() => navigation.navigate('Agreements')} full />
          <Button title="Acordos judiciais homologados" variant="secondary" onPress={() => navigation.navigate('LegalAgreements')} full />
          <Button title="Relatórios de Imposto de Renda" variant="ghost" onPress={() => navigation.navigate('TaxReports')} full />
          <Button title="Analytics e inteligência financeira" variant="ghost" onPress={() => navigation.navigate('PriorityAnalytics')} full />
        </Card>
      </Section>

      <Section title="Regra de negócio">
        <Card>
          <Text style={{ color: COLORS.text, lineHeight: 20 }}>
            Quando um acordo é marcado como homologado/substituindo a dívida, ele passa a ser considerado no planejamento mensal e na análise de comprometimento. A dívida original deve permanecer como histórico, mas o cálculo operacional passa a considerar a nova parcela.
          </Text>
        </Card>
      </Section>
    </ScreenScroll>
  );
}
