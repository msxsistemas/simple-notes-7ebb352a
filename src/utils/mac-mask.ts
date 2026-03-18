/**
 * Aplica máscara de MAC Address (XX:XX:XX:XX:XX:XX).
 * Se o valor contém '@', assume que é email e não aplica máscara.
 */
export function applyMacMask(value: string): string {
  if (!value) return value;

  // Remove tudo que não é alfanumérico
  const hex = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 12);
  
  if (!hex) return '';
  
  // Agrupa em pares separados por ':'
  const parts = hex.match(/.{1,2}/g) || [];
  return parts.join(':');
}
