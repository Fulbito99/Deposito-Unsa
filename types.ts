
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  masterStock: number;
  expirationDate?: string;
  additionalSkus?: string[];
}

export interface LocaleStock {
  productId: string;
  stock: number;
}

export interface Locale {
  id: string;
  name: string;
  inventory: LocaleStock[];
}

export interface Transfer {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  destinationLocaleId: string;
  destinationLocaleName: string;
  sourceLocaleId?: string;
  sourceLocaleName?: string;
  timestamp?: any;
}

export type ViewType = 'master' | 'locale-1' | 'locale-2' | 'locale-3' | 'history' | 'analytics' | 'management' | 'transfers';
