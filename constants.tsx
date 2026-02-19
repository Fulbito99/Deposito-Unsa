
import { Product, Locale } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', sku: 'LAP-001', name: 'Laptop Pro 14"', category: 'Electrónica', masterStock: 45 },
  { id: '2', sku: 'MOU-005', name: 'Mouse Ergonómico', category: 'Accesorios', masterStock: 120 },
  { id: '3', sku: 'KEY-012', name: 'Teclado Mecánico RGB', category: 'Accesorios', masterStock: 80 },
  { id: '4', sku: 'MON-088', name: 'Monitor 27" 4K', category: 'Electrónica', masterStock: 30 },
  { id: '5', sku: 'HEA-099', name: 'Auriculares Noise Cancelling', category: 'Audio', masterStock: 60 },
];

export const LOCALES: Locale[] = [
  { id: 'locale-1', name: 'El Punto', inventory: [] },
  { id: 'locale-2', name: 'La Central', inventory: [] },
  { id: 'locale-3', name: 'La Guardia', inventory: [] },
];
