import { Stack } from 'expo-router';

export default function ListaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="nueva" />
      <Stack.Screen name="unirse" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
