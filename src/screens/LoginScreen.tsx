import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Button, Card, Field } from "../components/UI";
import { colors } from "../theme/colors";
import { api, setToken } from "../services/api";

interface Props {
  onAuthSuccess: () => void;
}

export default function LoginScreen({ onAuthSuccess }: Props) {
  const [email, setEmail] = useState("bruno@financeiro.local");
  const [password, setPassword] = useState("Bruno@123");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const r = await api.login(email.trim().toLowerCase(), password);
      await setToken(r.token);
      onAuthSuccess();
    } catch (error: any) {
      Alert.alert("Erro no login", error?.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Card>
        <Text style={s.title}>Restauração Financeira</Text>
        <Text style={s.subtitle}>
          Login próprio estabilizado. Sem dependência de Google Sign-In.
        </Text>
        <Field
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <Field label="Senha" value={password} onChangeText={setPassword} />

        {loading ? (
          <ActivityIndicator color={colors.info} />
        ) : (
          <Button title="Entrar" onPress={handleLogin} />
        )}
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  help: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 12,
    textAlign: "center",
  },
});
