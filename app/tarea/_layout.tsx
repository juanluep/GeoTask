/**
 * Layout para la sección de detalle/edición de tareas.
 * Stack simple sin cabecera (cada pantalla tiene la suya propia).
 */
import { Stack } from 'expo-router';
export default function LayoutTarea() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
