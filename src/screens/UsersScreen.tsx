import React, { useEffect, useState } from "react";
import { Alert, Text, View, Switch } from "react-native";
import { api } from "../services/api";
import { Button, Card, Field, ScreenScroll, Section } from "../components/UI";

export default function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("Senha@123");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [u, s] = await Promise.all([api.listUsers(), api.listSessions()]);
      setUsers(Array.isArray(u) ? u : []);
      setSessions(Array.isArray(s) ? s : []);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar usuários.");
      setUsers([]);
      setSessions([]);
    }
  }

  useEffect(() => { load(); }, []);

  function reset() { setEditing(null); setEmail(""); setName(""); setPassword("Senha@123"); setActive(true); }
  function edit(u: any) { setEditing(u); setEmail(u.email || ""); setName(u.name || ""); setPassword(""); setActive(Boolean(u.active)); }

  const save = async () => {
    try {
      if (!email.trim()) return Alert.alert("Atenção", "Informe o e-mail do usuário.");
      if (!editing && (!password || password.length < 6)) return Alert.alert("Atenção", "A senha precisa ter pelo menos 6 caracteres.");
      const payload: any = { email: email.trim(), name: name || email, role: "OPERADOR", profile: "OPERADOR", active };
      if (password) payload.password = password;
      if (editing?.id) await api.updateUser(String(editing.id), payload);
      else await api.createUser(payload);
      reset(); await load(); Alert.alert("Pronto", editing ? "Usuário atualizado." : "Usuário criado.");
    } catch (e: any) { Alert.alert("Erro", e?.message || "Falha ao salvar usuário."); }
  };

  const remove = async (u: any) => {
    Alert.alert("Excluir usuário", `Desativar ${u.email}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Desativar", style: "destructive", onPress: async () => {
        try { await api.deleteUser(String(u.id)); await load(); if (editing?.id === u.id) reset(); }
        catch (e: any) { Alert.alert("Erro", e?.message || "Falha ao excluir usuário."); }
      }}
    ]);
  };

  return (
    <ScreenScroll>
      {error ? <Card><Text style={{ color: "#b91c1c", fontWeight: "700" }}>Erro: {error}</Text></Card> : null}
      <Section title={editing ? "Editar usuário" : "Novo usuário"}>
        <Card>
          <Field label="Nome" value={name} onChangeText={setName} />
          <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label={editing ? "Nova senha (opcional)" : "Senha inicial"} value={password} onChangeText={setPassword} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 8 }}>
            <Text>Usuário ativo</Text><Switch value={active} onValueChange={setActive} />
          </View>
          <Button title={editing ? "Salvar alterações" : "Criar usuário"} onPress={save} full />
          {editing ? <Button title="Cancelar edição" variant="ghost" onPress={reset} full /> : null}
        </Card>
      </Section>
      <Section title="Usuários">
        {users.map((u) => (
          <Card key={u.id}>
            <Text style={{ fontWeight: "700" }}>{u.name || u.email}</Text>
            <Text>{u.email}</Text>
            <Text>{u.role} · {u.profile} · {u.active ? "ativo" : "inativo"}</Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              <Button title="Editar" variant="ghost" onPress={() => edit(u)} full />
              <Button title="Excluir/desativar" variant="danger" onPress={() => remove(u)} full />
            </View>
          </Card>
        ))}
      </Section>
      <Section title="Sessões">
        {sessions.map((s) => (
          <Card key={s.id}>
            <Text style={{ fontWeight: "700" }}>{s.active ? "Ativa" : "Encerrada"}</Text>
            <Text>{new Date(s.createdAt).toLocaleString("pt-BR")}</Text>
            <Text numberOfLines={2}>{s.userAgent || "Sem user-agent"}</Text>
          </Card>
        ))}
      </Section>
    </ScreenScroll>
  );
}
