import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Section } from '../components/UI';
import { useFinanceStore } from '../store/useStore';
import { COLORS, SPACING } from '../utils/theme';
import { fmtBRL, parseNumber } from '../utils/format';
import type { Income, MinExistencial } from '../db/types';

export default function IncomeScreen() {
  const { income, minExist, saveIncome, saveMinExist, loadAll } = useFinanceStore();
  const [inc, setInc] = useState<Income>(income);
  const [me, setMe] = useState<MinExistencial>(minExist);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setInc(income); setMe(minExist); }, [income, minExist]);

  const totalMinE =
    me.alimentacao + me.transporte + me.agua + me.energia +
    me.internet + me.saude + me.outros;
  const sobraAposMinE = inc.liquido - totalMinE - me.reserva;

  const onChangeInc = (k: keyof Income, v: any) => { setInc({ ...inc, [k]: v }); setDirty(true); };
  const onChangeMe  = (k: keyof MinExistencial, v: number) => { setMe({ ...me, [k]: v }); setDirty(true); };

  const handleSave = async () => {
    if (totalMinE + me.reserva > inc.liquido) {
      Alert.alert(
        'Atenção',
        `Mínimo existencial + reserva (${fmtBRL(totalMinE + me.reserva)}) ` +
        `é maior que a renda líquida (${fmtBRL(inc.liquido)}). ` +
        `Deseja salvar mesmo assim?`,
        [
          { text: 'Voltar', style: 'cancel' },
          { text: 'Salvar', onPress: doSave },
        ]
      );
      return;
    }
    doSave();
  };
  const doSave = async () => {
    await saveIncome(inc);
    await saveMinExist(me);
    await loadAll();
    setDirty(false);
    Alert.alert('Pronto', 'Renda e mínimo existencial atualizados.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md }}>
          Renda e mínimo existencial
        </Text>

        <Card>
          <Section title="Renda">
            <Field
              label="Renda bruta mensal (R$)"
              keyboardType="decimal-pad"
              value={String(inc.bruto || '')}
              onChangeText={(t) => onChangeInc('bruto', parseNumber(t))}
            />
            <Field
              label="Renda líquida mensal (R$)"
              keyboardType="decimal-pad"
              value={String(inc.liquido || '')}
              onChangeText={(t) => onChangeInc('liquido', parseNumber(t))}
            />
            <Field
              label="Fonte pagadora"
              value={inc.fontePagadora}
              onChangeText={(t) => onChangeInc('fontePagadora', t)}
            />
            <Field
              label="Banco onde recebe"
              value={inc.banco}
              onChangeText={(t) => onChangeInc('banco', t)}
            />
            <Field
              label="Dia do recebimento"
              value={inc.dataRecebimento}
              onChangeText={(t) => onChangeInc('dataRecebimento', t)}
            />
          </Section>
        </Card>

        <Card>
          <Section title="Mínimo existencial">
            <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>
              Lei 14.181/2021 — valor mínimo de subsistência que NÃO pode ser comprometido com
              dívidas. Inclua despesas essenciais e fixas.
            </Text>
            <Field
              label="Alimentação"
              keyboardType="decimal-pad"
              value={String(me.alimentacao || '')}
              onChangeText={(t) => onChangeMe('alimentacao', parseNumber(t))}
            />
            <Field
              label="Transporte"
              keyboardType="decimal-pad"
              value={String(me.transporte || '')}
              onChangeText={(t) => onChangeMe('transporte', parseNumber(t))}
            />
            <Field
              label="Água"
              keyboardType="decimal-pad"
              value={String(me.agua || '')}
              onChangeText={(t) => onChangeMe('agua', parseNumber(t))}
            />
            <Field
              label="Energia elétrica"
              keyboardType="decimal-pad"
              value={String(me.energia || '')}
              onChangeText={(t) => onChangeMe('energia', parseNumber(t))}
            />
            <Field
              label="Internet / telefone"
              keyboardType="decimal-pad"
              value={String(me.internet || '')}
              onChangeText={(t) => onChangeMe('internet', parseNumber(t))}
            />
            <Field
              label="Saúde / medicamentos"
              keyboardType="decimal-pad"
              value={String(me.saude || '')}
              onChangeText={(t) => onChangeMe('saude', parseNumber(t))}
            />
            <Field
              label="Outros essenciais"
              keyboardType="decimal-pad"
              value={String(me.outros || '')}
              onChangeText={(t) => onChangeMe('outros', parseNumber(t))}
            />

            <View
              style={{
                marginTop: 8, padding: 12, backgroundColor: COLORS.warningBg,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: COLORS.warning, fontWeight: '700' }}>
                Total mínimo existencial: {fmtBRL(totalMinE)}
              </Text>
            </View>
          </Section>

          <Section title="Reserva mensal">
            <Field
              label="Reserva para emergências (R$)"
              keyboardType="decimal-pad"
              value={String(me.reserva || '')}
              onChangeText={(t) => onChangeMe('reserva', parseNumber(t))}
            />
            <Text style={{ fontSize: 11, color: COLORS.muted }}>
              Valor que você guarda todo mês antes de pagar dívidas. Recomenda-se 5–10% da renda.
            </Text>
          </Section>

          <View
            style={{
              padding: 12,
              backgroundColor:
                sobraAposMinE >= 0 ? COLORS.successBg : COLORS.dangerBg,
              borderRadius: 6, marginTop: 8,
            }}
          >
            <Text
              style={{
                color: sobraAposMinE >= 0 ? COLORS.success : COLORS.danger,
                fontWeight: '700',
              }}
            >
              Capacidade para pagar dívidas: {fmtBRL(Math.max(0, sobraAposMinE))}
            </Text>
            <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
              Renda líquida − mínimo existencial − reserva. Não comprometa acima disso.
            </Text>
          </View>
        </Card>

        <Button title={dirty ? 'Salvar alterações' : 'Salvar'} onPress={handleSave} full />
      </ScrollView>
    </SafeAreaView>
  );
}
