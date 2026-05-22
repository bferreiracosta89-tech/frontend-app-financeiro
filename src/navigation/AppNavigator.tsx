import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
import DashboardScreen from '../screens/DashboardScreen';
import DebtsScreen from '../screens/DebtsScreen';
import DebtPaymentsScreen from '../screens/DebtPaymentsScreen';
import CardPurchasesScreen from '../screens/CardPurchasesScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import AccountsScreen from '../screens/AccountsScreen';
import IncomeScreen from '../screens/IncomeScreen';
import NegotiationsScreen from '../screens/NegotiationsScreen';
import AgreementsScreen from '../screens/AgreementsScreen';
import LegalAgreementsScreen from '../screens/LegalAgreementsScreen';
import LegalScreen from '../screens/LegalScreen';
import MesAMesScreen from '../screens/MesAMesScreen';
import MonthlyMatrixScreen from '../screens/MonthlyMatrixScreen';
import TaxReportsScreen from '../screens/TaxReportsScreen';
import UsersScreen from '../screens/UsersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PriorityAnalyticsScreen from '../screens/PriorityAnalyticsScreen';
import { COLORS, RADIUS } from '../utils/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const Icon = ({ label, focused }: { label: string; focused: boolean }) => (
  <View
    style={{
      width: 34,
      height: 28,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: focused ? COLORS.infoBg : 'transparent',
    }}
  >
    <Text style={{ fontSize: 17, color: focused ? COLORS.info : COLORS.muted }}>{label}</Text>
  </View>
);

function DebtsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DebtsList" component={DebtsScreen} />
      <Stack.Screen name="DebtPayments" component={DebtPaymentsScreen} />
      <Stack.Screen name="CardPurchases" component={CardPurchasesScreen} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreHome" component={SettingsScreen} />
      <Stack.Screen name="Income" component={IncomeScreen} />
      <Stack.Screen name="Negotiations" component={NegotiationsScreen} />
      <Stack.Screen name="Agreements" component={AgreementsScreen} />
      <Stack.Screen name="LegalAgreements" component={LegalAgreementsScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="MesAMes" component={MesAMesScreen} />
      <Stack.Screen name="MonthlyMatrix" component={MonthlyMatrixScreen} />
      <Stack.Screen name="TaxReports" component={TaxReportsScreen} />
      <Stack.Screen name="Users" component={UsersScreen} />
      <Stack.Screen name="PriorityAnalytics" component={PriorityAnalyticsScreen} />
      <Stack.Screen name="CardPurchases" component={CardPurchasesScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: COLORS.info,
          tabBarInactiveTintColor: COLORS.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height: 66,
            paddingTop: 6,
            paddingBottom: 6,
            elevation: 8,
          },
          tabBarIcon: ({ focused }) => {
            const map: Record<string, string> = {
              Dashboard: '📊', Debts: '💳', Expenses: '🧾',
              Accounts: '🏦', More: '☰',
            };
            return <Icon label={map[route.name] || '•'} focused={focused} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Painel' }} />
        <Tab.Screen name="Debts" component={DebtsStack} options={{ title: 'Dívidas' }} />
        <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Gastos' }} />
        <Tab.Screen name="Accounts" component={AccountsScreen} options={{ title: 'Contas' }} />
        <Tab.Screen name="More" component={MoreStack} options={{ title: 'Mais' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
