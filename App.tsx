import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { initDatabase } from "./src/db/database";
import { useFinanceStore } from "./src/store/useStore";
import { startAutoSync, stopAutoSync } from "./src/services/sync";
import { hasToken } from "./src/services/api";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import DebtsScreen from "./src/screens/DebtsScreen";
import ExpensesScreen from "./src/screens/ExpensesScreen";
import IncomeScreen from "./src/screens/IncomeScreen";
import MonthlyMatrixScreen from "./src/screens/MonthlyMatrixScreen";
import AccountsScreen from "./src/screens/AccountsScreen";
import NegotiationsScreen from "./src/screens/NegotiationsScreen";
import LegalScreen from "./src/screens/LegalScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import DebtPaymentsScreen from "./src/screens/DebtPaymentsScreen";
import AgreementsScreen from "./src/screens/AgreementsScreen";
import LegalAgreementsScreen from "./src/screens/LegalAgreementsScreen";
import TaxReportsScreen from "./src/screens/TaxReportsScreen";
import UsersScreen from "./src/screens/UsersScreen";
import MoreScreen from "./src/screens/MoreScreen";

import { colors } from "./src/theme/colors";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTitleStyle: { color: "#111827", fontWeight: "700" },
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          height: 76,
          paddingBottom: 12,
          paddingTop: 8,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          elevation: 14,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
      }}
    >
      <Tab.Screen
        name="Painel"
        component={DashboardScreen}
        options={{ tabBarIcon: tabIcon("home-outline") }}
      />
      <Tab.Screen
        name="Dívidas"
        component={DebtsScreen}
        options={{ tabBarIcon: tabIcon("card-outline") }}
      />
      <Tab.Screen
        name="Mês"
        component={MonthlyMatrixScreen}
        options={{
          title: "Mês a Mês",
          tabBarIcon: tabIcon("calendar-outline"),
        }}
      />
      <Tab.Screen
        name="Gastos"
        component={ExpensesScreen}
        options={{ tabBarIcon: tabIcon("wallet-outline") }}
      />
      <Tab.Screen
        name="Renda"
        component={IncomeScreen}
        options={{ tabBarIcon: tabIcon("cash-outline") }}
      />
      <Tab.Screen
        name="Mais"
        component={MoreScreen}
        options={{ tabBarIcon: tabIcon("grid-outline") }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState(false);
  const loadAll = useFinanceStore((s) => s.loadAll);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initDatabase();
        await loadAll();
        const ok = await hasToken();
        if (mounted) setAuth(ok);
      } catch (e) {
        console.error("APP_INIT_ERROR", e);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadAll]);

  useEffect(() => {
    (globalThis as any).__CRF_SET_AUTH__ = setAuth;
    return () => { delete (globalThis as any).__CRF_SET_AUTH__; };
  }, []);

  useEffect(() => {
    if (auth) startAutoSync();
    else stopAutoSync();
    return () => stopAutoSync();
  }, [auth]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.bg,
          }}
        >
          <ActivityIndicator color={colors.info} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!auth) {
    return (
      <SafeAreaProvider>
        <LoginScreen onAuthSuccess={() => setAuth(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Início"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Pagamentos"
            component={DebtPaymentsScreen as React.ComponentType<any>}
          />
          <Stack.Screen name="Acordos" component={AgreementsScreen} />
          <Stack.Screen name="Judicial" component={LegalAgreementsScreen} />
          <Stack.Screen name="IRPF" component={TaxReportsScreen} />
          <Stack.Screen name="Contas" component={AccountsScreen} />
          <Stack.Screen name="Negociações" component={NegotiationsScreen} />
          <Stack.Screen name="Jurídico" component={LegalScreen} />
          <Stack.Screen name="Usuários" component={UsersScreen} />
          <Stack.Screen name="Configurações" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
