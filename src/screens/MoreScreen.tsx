import React from "react";
import { Text } from "react-native";
import { Button, Card, ScreenScroll, Section } from "../components/UI";

export default function MoreScreen({ navigation }: any) {
  const nav = navigation;

  return (
    <ScreenScroll>
      <Section title="Operações essenciais">
        <Card>
          <Button
            title="Pagamentos de dívidas"
            onPress={() => nav.navigate("Pagamentos")}
          />

          <Button
            title="Acordos / Renegociação"
            variant="secondary"
            onPress={() => nav.navigate("Acordos")}
          />

          <Button
            title="Acordos judiciais"
            variant="secondary"
            onPress={() => nav.navigate("Judicial")}
          />

          <Button
            title="IRPF / Relatórios fiscais"
            variant="secondary"
            onPress={() => nav.navigate("IRPF")}
          />
        </Card>
      </Section>

      <Section title="Gestão">
        <Card>
          <Button
            title="Contas"
            variant="ghost"
            onPress={() => nav.navigate("Contas")}
          />

          <Button
            title="Negociações"
            variant="ghost"
            onPress={() => nav.navigate("Negociações")}
          />

          <Button
            title="Jurídico / Superendividamento"
            variant="ghost"
            onPress={() => nav.navigate("Jurídico")}
          />

          <Button
            title="Usuários, perfis e sessões"
            variant="ghost"
            onPress={() => nav.navigate("Usuários")}
          />

          <Button
            title="Configurações e exportações"
            variant="ghost"
            onPress={() => nav.navigate("Configurações")}
          />
        </Card>
      </Section>

      <Card>
        <Text style={{ color: "#6B7280", lineHeight: 18 }}>
          Todas as telas críticas foram reunidas aqui para evitar funções
          sumidas.
        </Text>
      </Card>
    </ScreenScroll>
  );
}
