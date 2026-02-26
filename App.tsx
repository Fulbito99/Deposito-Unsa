
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Warehouse,
  Store,
  History,
  ArrowRightLeft,
  AlertCircle,
  Package,
  Search,
  Boxes,
  ArrowUpRight,
  Layers,
  MoreVertical,
  ChevronRight,
  X,
  Edit2,
  Trash2,
  Menu,
  Plus,
  Download,
  Upload,
  Settings,
  Calendar,
  AlertTriangle,
  MapPin,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Camera,
  RefreshCw,
  FileText,
  Laptop
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, Locale, Transfer, ViewType } from './types';
import { INITIAL_PRODUCTS, LOCALES } from './constants';
import { PRODUCT_NAMES } from './product-names';
import { db } from './firebase';
import BarcodeScanner from './BarcodeScanner';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  limit,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  where,
  Timestamp
} from 'firebase/firestore';
import {
  Wifi,
  WifiOff,
  Cloud,
  Smartphone,
  CheckCircle2,
  LogOut,
  User
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

// --- Reusable UI Components ---

const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isCollapsed?: boolean;
}> = ({ icon, label, active, onClick, isCollapsed }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : ""}
    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-4'} py-3.5 rounded-xl transition-all duration-300 group ${active
      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'} ${isCollapsed ? '' : ''}`}>
      {icon}
    </div>
    {!isCollapsed && <span className="font-semibold text-sm tracking-wide truncate">{label}</span>}
    {active && !isCollapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
  </button>
);

const BottomNavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${active ? 'text-indigo-500' : 'text-slate-400'
      }`}
  >
    <div className={`p-1 rounded-xl transition-all ${active ? 'bg-indigo-50' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{label}</span>
  </button>
);

const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string; noPadding?: boolean; headerAction?: React.ReactNode }> = ({ title, children, className, noPadding, headerAction }) => (
  <div className={`bg-white rounded-3xl md:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden transition-all ${className}`}>
    {(title || headerAction) && (
      <div className="px-6 md:px-8 py-5 md:py-6 border-b border-slate-50 flex items-center justify-between">
        {title && <h3 className="text-base md:text-lg font-bold text-slate-800">{title}</h3>}
        {headerAction && <div>{headerAction}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-6 md:p-8'}>
      {children}
    </div>
  </div>
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; trend?: string; color: string; bgColor: string; onClick?: () => void }> = ({ icon, label, value, trend, color, bgColor, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group ${onClick ? 'cursor-pointer hover:border-indigo-200 transition-colors' : ''}`}
  >
    <div className="flex items-center md:flex-col md:items-start md:space-y-4 space-x-4 md:space-x-0">
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl ${bgColor} ${color} flex items-center justify-center shadow-inner shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">{label}</p>
        <div className="flex items-baseline space-x-2">
          <p className="text-xl md:text-3xl font-extrabold text-slate-900 leading-none">{value}</p>
          {trend && (
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center">
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);

// --- Helper Functions ---

const matchesSearch = (product: Product, term: string) => {
  if (!term) return true;
  const t = term.toLowerCase().trim();
  const name = product.name ? product.name.toLowerCase() : '';
  const sku = product.sku ? product.sku.toLowerCase() : '';

  return (
    name.includes(t) ||
    sku.includes(t) ||
    product.additionalSkus?.some(ask => ask && ask.toLowerCase().includes(t)) || false
  );
};

const getFilteredTransferProducts = (products: Product[], term: string, category: string) => {
  return products.filter(p => {
    // 1. Must match search term (if present)
    const matchesText = matchesSearch(p, term);
    if (!matchesText) return false;

    // 2. If term is empty, just filter by category
    if (!term.trim()) {
      return category === 'all' || p.category === category;
    }

    // 3. If term is present:
    //    - If it's an EXACT SKU/AdditionalSKU match, BYPASS category filter (User expectation: "I scanned it, I want it")
    const cleanTerm = term.trim().toUpperCase();
    const isStrongMatch = p.sku === cleanTerm || p.additionalSkus?.some(ask => ask === cleanTerm);

    if (isStrongMatch) return true;

    //    - Otherwise, respect category filter
    return category === 'all' || p.category === category;
  });
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<ViewType>(() => {
    return (localStorage.getItem('current_view') as ViewType) || 'analytics';
  });

  useEffect(() => {
    localStorage.setItem('current_view', view);
  }, [view]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // --- Storage Mode State ---
  const [storageMode, setStorageMode] = useState<'local' | 'cloud' | null>(() => {
    return localStorage.getItem('storage_preference') as 'local' | 'cloud' | null;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [locales, setLocales] = useState<Locale[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [stats, setStats] = useState<any>(null);

  const [historyFilterStart, setHistoryFilterStart] = useState('');
  const [historyFilterEnd, setHistoryFilterEnd] = useState('');
  const [historyFilterLocale, setHistoryFilterLocale] = useState<string>('');
  const [historyFilterMode, setHistoryFilterMode] = useState<'date' | 'range'>('range');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySingleDate, setHistorySingleDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // --- Initial Data Load (Local Mode) ---
  useEffect(() => {
    if (storageMode === 'local') {
      const savedProducts = localStorage.getItem('master_inventory');
      setProducts(savedProducts ? JSON.parse(savedProducts) : INITIAL_PRODUCTS);

      const savedLocales = localStorage.getItem('locales_inventory');
      if (savedLocales) {
        setLocales(JSON.parse(savedLocales));
      } else {
        setLocales(LOCALES);
      }

      const savedTransfers = localStorage.getItem('transfer_history');
      setTransfers(savedTransfers ? JSON.parse(savedTransfers) : []);
    }
  }, [storageMode]);

  // --- Firebase Sync (Cloud Mode) ---
  useEffect(() => {
    if (storageMode !== 'cloud') return;

    // Real-time: Listen for Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      if (docs.length > 0) setProducts(docs);
      else setProducts(INITIAL_PRODUCTS);
    }, (error) => console.error("Error watching products:", error));

    // Real-time: Listen for Locales
    const unsubLocales = onSnapshot(collection(db, 'locales'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || 'Sin nombre', inventory: doc.data().inventory || [] } as Locale));
      if (docs.length > 0) setLocales(docs);
      else LOCALES.forEach(async l => await setDoc(doc(db, 'locales', l.id), l));
    }, (error) => console.error("Error watching locales:", error));

    // Optimized: Fetch history with limit
    let unsubTransfers = () => { };

    // Check if any filter is active
    const isFilterActive =
      (historyFilterMode === 'date' && historySingleDate) ||
      (historyFilterMode === 'range' && (historyFilterStart || historyFilterEnd)) ||
      (historySearchTerm.trim().length > 0);

    if (isFilterActive) {
      const constraints: any[] = [orderBy('timestamp', 'desc'), limit(historyLimit)];

      if (historyFilterMode === 'date' && historySingleDate) {
        const [y, m, d] = historySingleDate.split('-').map(Number);
        constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0))));
        constraints.push(where('timestamp', '<=', Timestamp.fromDate(new Date(y, m - 1, d, 23, 59, 59))));
      } else if (historyFilterMode === 'range' && (historyFilterStart || historyFilterEnd)) {
        if (historyFilterStart) {
          const [y, m, d] = historyFilterStart.split('-').map(Number);
          constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0))));
        }
        if (historyFilterEnd) {
          const [y, m, d] = historyFilterEnd.split('-').map(Number);
          constraints.push(where('timestamp', '<=', Timestamp.fromDate(new Date(y, m - 1, d, 23, 59, 59))));
        }
      }

      const qTransfers = query(collection(db, 'transfers'), ...constraints);
      unsubTransfers = onSnapshot(qTransfers, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transfer));
        const sortedDocs = docs.sort((a, b) => {
          if (!a.date || !b.date) return 0;
          const parseDateTime = (str: string) => {
            try {
              const parts = str.split(',');
              const datePart = parts[0].trim();
              const [d, m, y] = datePart.split('/').map(Number);
              const timePart = parts[1]?.trim();
              if (timePart) {
                const [hh, mm, ss] = timePart.split(':').map(Number);
                return new Date(y, m - 1, d, hh, mm, ss).getTime();
              }
              return new Date(y, m - 1, d).getTime();
            } catch (e) { return 0; }
          };
          const res = parseDateTime(b.date) - parseDateTime(a.date);
          if (res !== 0) return res;
          if (a.timestamp && b.timestamp) return b.timestamp.toMillis() - a.timestamp.toMillis();
          return 0;
        });
        setTransfers(Array.from(new Map(sortedDocs.map(item => [item.id, item])).values()));
      }, (error) => console.error("Error fetching transfers:", error));
    } else {
      setTransfers([]);
    }

    // Sync categories
    const unsubCategories = onSnapshot(doc(db, 'settings', 'categories'), (docSnap) => {
      if (docSnap.exists() && Array.isArray(docSnap.data().customCategories)) {
        setCustomCategories(docSnap.data().customCategories);
      }
    });

    // Subscripción a estadísticas del dashboard
    const unsubStats = onSnapshot(doc(db, 'settings', 'dashboard_stats'), (docSnap) => {
      if (docSnap.exists()) setStats(docSnap.data());
    });

    return () => {
      unsubProducts();
      unsubLocales();
      unsubTransfers();
      unsubCategories();
      unsubStats();
    };
  }, [storageMode, historyLimit, historyFilterMode, historySingleDate, historyFilterStart, historyFilterEnd, historySearchTerm]);



  // --- PWA Installation Logic ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if the event was already fired before React mounted
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e; // Store it globally too
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    });
  };

  const selectStorageMode = (mode: 'local' | 'cloud') => {
    setStorageMode(mode);
    localStorage.setItem('storage_preference', mode);
    // Reload to ensure clean state transition
    window.location.reload();
  };




  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [transferData, setTransferData] = useState({
    productId: '',
    localeId: '',
    sourceLocaleId: 'deposit',
    quantity: 0
  });
  const [transferCategoryFilter, setTransferCategoryFilter] = useState('all');
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [showTransferSuggestions, setShowTransferSuggestions] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSecondaryScannerOpen, setIsSecondaryScannerOpen] = useState(false); // For adding SKUs
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productData, setProductData] = useState({
    sku: '',
    name: '',
    category: '',
    masterStock: 0,

    expirationDate: '',
    additionalSkus: [] as string[]
  });
  const [productNameSuggestions, setProductNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const productNameInputRef = useRef<HTMLInputElement>(null);


  const [isNewLocaleModalOpen, setIsNewLocaleModalOpen] = useState(false);
  const [isManageLocalesModalOpen, setIsManageLocalesModalOpen] = useState(false);

  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [selectedManagementCategory, setSelectedManagementCategory] = useState<string | null>(null);

  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Error al iniciar sesión con Google");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // --- Initial Layout Logic adjustment for loading ---
  const [newLocaleName, setNewLocaleName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showExpirationOnly, setShowExpirationOnly] = useState(false);
  const [trendInterval, setTrendInterval] = useState<'weekly' | 'monthly'>('monthly');

  const updateDashboardStats = async (newTransfers: Transfer[], currentLocales: Locale[]) => {
    if (storageMode !== 'cloud' || !newTransfers.length) return;

    // This is a heavy operation, but we only do it on write
    // In a real production app, this would be a Cloud Function
    const distribution: { [key: string]: { name: string; value: number } } = {};
    newTransfers.forEach(t => {
      if (!t) return;
      const name = t.productName || 'Unknown';
      distribution[name] = { name, value: (distribution[name]?.value || 0) + t.quantity };
    });

    const destinationComparison = currentLocales.map(locale => {
      const localeTransfers = newTransfers.filter(t => t.destinationLocaleId === locale.id);
      return {
        destino: locale.name,
        total: localeTransfers.reduce((sum, t) => sum + t.quantity, 0),
        movimientos: localeTransfers.length
      };
    });

    const summary = {
      distributionData: Object.values(distribution).sort((a, b) => b.value - a.value).slice(0, 8),
      destinationComparison: destinationComparison.sort((a, b) => b.total - a.total),
      lastUpdated: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'settings', 'dashboard_stats'), summary, { merge: true });
    } catch (e) {
      console.error("Error updating stats:", e);
    }
  };

  // --- Analytics data processing ---
  const analyticsData = useMemo(() => {
    if (storageMode === 'cloud' && stats) {
      return {
        ...stats,
        // Trend data still calculated locally from what we have or placeholder
        trendData: stats.trendData || [],
        topProductsByDestination: stats.topProductsByDestination || []
      };
    }
    const safeTransfers = Array.isArray(transfers) ? transfers : [];
    const safeLocales = Array.isArray(locales) ? locales : [];

    const topProductsByDestination = safeLocales.map(locale => {
      const localeTransfers = safeTransfers.filter(t => t?.destinationLocaleId === locale.id);
      const productTotals: { [key: string]: { name: string; total: number } } = {};
      localeTransfers.forEach(t => {
        if (!t) return;
        const prodId = t.productId || 'unknown';
        const prodName = t.productName || 'Producto Desconocido';
        if (!productTotals[prodId]) {
          productTotals[prodId] = { name: prodName, total: 0 };
        }
        productTotals[prodId].total += (t.quantity || 0);
      });
      const topProducts = Object.values(productTotals)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      return {
        localeName: locale.name || 'Sin nombre',
        products: topProducts
      };
    });

    const productDistribution: { [key: string]: { name: string; value: number } } = {};
    safeTransfers.forEach(t => {
      if (!t) return;
      const prodId = t.productId || 'unknown';
      const prodName = t.productName || 'Producto Desconocido';
      if (!productDistribution[prodId]) {
        productDistribution[prodId] = { name: prodName, value: 0 };
      }
      productDistribution[prodId].value += (t.quantity || 0);
    });
    const distributionData = Object.values(productDistribution)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);


    const trendDays = trendInterval === 'weekly' ? 7 : 30;
    const trendData = Array.from({ length: trendDays }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - ((trendDays - 1) - i));
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const dateStr = `${d}/${m}`;

      const dayTransfers = safeTransfers.filter(t => {
        if (!t?.date) return false;
        const match = t.date.match(/(\d{1,2})\/(\d{1,2})/);
        if (match) {
          const dMatch = match[1].padStart(2, '0');
          const mMatch = match[2].padStart(2, '0');
          return `${dMatch}/${mMatch}` === dateStr;
        }
        return false;
      });
      const total = dayTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);
      return { date: dateStr, cantidad: total };
    });

    const destinationComparison = safeLocales.map(locale => {
      if (!locale) return { destino: '?', total: 0, movimientos: 0 };
      const localeTransfers = safeTransfers.filter(t => t?.destinationLocaleId === locale.id);
      const total = localeTransfers.reduce((sum, t) => sum + (t?.quantity || 0), 0);
      const count = localeTransfers.length;
      const label = (locale.name || 'Desconocido');
      return {
        destino: label.length > 15 ? label.substring(0, 15) + '...' : label,
        total,
        movimientos: count
      };
    }).sort((a, b) => b.total - a.total);

    return {
      topProductsByDestination,
      distributionData,
      trendData,
      destinationComparison
    };
  }, [transfers, locales, trendInterval]);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6'];

  // Load custom categories from localStorage (local mode) or wait for Firestore (cloud mode)
  useEffect(() => {
    if (storageMode === 'cloud') {
      // Categories will be loaded from Firestore listener above
      return;
    }
    const savedCategories = localStorage.getItem('custom_categories');
    if (savedCategories) {
      const loaded = JSON.parse(savedCategories);
      setCustomCategories(loaded);
    } else {
      setCustomCategories([]);
    }
  }, [storageMode]);

  // Combined categories from products + custom categories
  const categories = useMemo(() => {
    const productCategories = [...new Set(products.map(p => p.category))];
    const allCategories = [...new Set([...productCategories, ...customCategories])];
    return ['all', ...allCategories.sort()];
  }, [products, customCategories]);

  const supplierOptions = useMemo(() => {
    const cats = categories.filter(c => c !== 'all');
    const locs = locales.map(l => l.name);
    return [...cats, ...locs].sort();
  }, [categories, locales]);

  // --- Data Persistence ---
  useEffect(() => {
    localStorage.setItem('master_inventory', JSON.stringify(products));
    localStorage.setItem('locales_inventory', JSON.stringify(locales));
    localStorage.setItem('transfer_history', JSON.stringify(transfers));
    localStorage.setItem('custom_categories', JSON.stringify(customCategories));

    // NO CLOUD SYNC HERE - It causes infinite loop with the listener.
    // Categories are now synced explicitly in handleAdd/Edit/Delete
  }, [products, locales, transfers, customCategories]);

  const openNewTransfer = (initialData?: { productId: string; localeId: string; quantity: number; sourceLocaleId?: string }) => {
    setEditingTransferId(null);
    setTransferData(initialData ? { ...initialData, sourceLocaleId: initialData.sourceLocaleId || 'deposit' } : { productId: '', localeId: '', sourceLocaleId: 'deposit', quantity: 0 });
    setTransferCategoryFilter('all');
    setTransferSearchTerm(initialData ? products.find(p => p.id === initialData.productId)?.name || '' : '');
    setIsTransferModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleRepeatTransfer = (t: Transfer) => {
    openNewTransfer({
      productId: t.productId,
      localeId: t.destinationLocaleId,
      quantity: t.quantity,
      sourceLocaleId: t.sourceLocaleId || 'deposit'
    });
  };

  const openEditTransfer = (transfer: Transfer) => {
    setEditingTransferId(transfer.id);
    setTransferData({
      productId: transfer.productId,

      localeId: transfer.destinationLocaleId,
      sourceLocaleId: transfer.sourceLocaleId || 'deposit',
      quantity: transfer.quantity
    });
    setTransferSearchTerm(products.find(p => p.id === transfer.productId)?.name || '');
    setIsTransferModalOpen(true);
  };

  // Optimized filtered products for transfer modal
  const filteredProductsForTransfer = useMemo(() => {
    return products.filter(p => transferCategoryFilter === 'all' || p.category === transferCategoryFilter);
  }, [products, transferCategoryFilter]);

  // Handle barcode scan result
  const handleBarcodeScan = (scannedCode: string) => {
    const cleanCode = scannedCode.trim();
    setIsScannerOpen(false);

    // If product modal is open, fill SKU field
    if (isProductModalOpen) {
      setProductData({ ...productData, sku: cleanCode.toUpperCase() });
      alert(`✓ SKU escaneado: ${cleanCode.toUpperCase()}`);
      return;
    }

    // Default: Main View Search using Scanner

    // If transfer modal is open or we are in transfers view, search for product by SKU
    if (isTransferModalOpen || view === 'transfers') {
      const foundProduct = products.find(p => matchesSearch(p, cleanCode));

      if (foundProduct) {
        // Auto-select the product
        setTransferData({ ...transferData, productId: foundProduct.id });
        setTransferSearchTerm(foundProduct.name);

        // Update category filter to show the product
        setTransferCategoryFilter(foundProduct.category);

        // Show success feedback
        alert(`✓ Producto encontrado: ${foundProduct.name}`);
      } else {
        // Product not found
        alert(`✗ No se encontró ningún producto con el código: ${cleanCode}`);
      }
      return;
    }

    // Default: Main View Search using Scanner
    setSearchTerm(cleanCode);
    alert(`✓ Producto escaneado: ${cleanCode}`);
  };

  const handleDeleteTransfer = async (transferId: string) => {
    if (!window.confirm("¿Eliminar movimiento? Se revertirán los cambios de stock.")) return;

    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return;

    const { productId, quantity, sourceLocaleId, destinationLocaleId } = transfer;

    try {
      if (storageMode === 'cloud') {
        await runTransaction(db, async (transaction) => {
          const productRef = doc(db, 'products', productId);
          const productDoc = await transaction.get(productRef);

          let destRef = null;
          let destDoc = null;
          if (destinationLocaleId !== 'deposit') {
            destRef = doc(db, 'locales', destinationLocaleId);
            destDoc = await transaction.get(destRef);
          }

          let sourceRef = null;
          let sourceDoc = null;
          if (sourceLocaleId !== 'deposit' && destinationLocaleId !== 'deposit') {
            sourceRef = doc(db, 'locales', sourceLocaleId);
            sourceDoc = await transaction.get(sourceRef);
          }

          // Determine Master Stock changes
          let masterStockChange = 0;

          // 1. Revert Destination (Subtract stock that was added)
          if (destinationLocaleId === 'deposit') {
            masterStockChange -= quantity;
          } else {
            if (destRef && destDoc && destDoc.exists()) {
              const currentInv = destDoc.data().inventory || [];
              const newInv = currentInv.map((item: any) =>
                item.productId === productId ? { ...item, stock: Math.max(0, item.stock - quantity) } : item
              );
              transaction.update(destRef, { inventory: newInv });
            }
          }

          // 2. Revert Source (Add back stock that was deducted)
          // IF Destination was Deposit, user wants to ONLY subtract from Deposit, skipping source reversal
          if (sourceLocaleId !== 'deposit' && destinationLocaleId !== 'deposit') {
            if (sourceRef && sourceDoc && sourceDoc.exists()) {
              const sData = sourceDoc.data();
              const isSourceExempt = ['PRADERAS', 'DIQUE', 'SOHO', 'MARKET'].includes((sData.name || '').toUpperCase());

              if (!isSourceExempt) {
                const currentInv = sData.inventory || [];
                const hasItem = currentInv.some((i: any) => i.productId === productId);
                let newInv;
                if (hasItem) {
                  newInv = currentInv.map((item: any) => item.productId === productId ? { ...item, stock: item.stock + quantity } : item);
                } else {
                  newInv = [...currentInv, { productId, stock: quantity }];
                }
                transaction.update(sourceRef, { inventory: newInv });
              }
            }
          } else if (sourceLocaleId === 'deposit') {
            masterStockChange += quantity;
          }

          if (productDoc.exists() && masterStockChange !== 0) {
            transaction.update(productRef, { masterStock: (productDoc.data().masterStock || 0) + masterStockChange });
          }

          transaction.delete(doc(db, 'transfers', transferId));
        });

      } else {
        // LOCAL LOGIC
        // 1. Update Master Stock if needed
        setProducts(prev => prev.map(p => {
          if (p.id !== productId) return p;
          let change = 0;
          if (destinationLocaleId === 'deposit') change -= quantity;
          if (sourceLocaleId === 'deposit') change += quantity;
          return { ...p, masterStock: p.masterStock + change };
        }));

        // 2. Update Locales
        setLocales(prev => prev.map(l => {
          const isExempt = ['PRADERAS', 'DIQUE', 'SOHO', 'MARKET'].includes((l.name || '').toUpperCase());

          // Revert Destination (Subtract)
          if (l.id === destinationLocaleId) {
            return {
              ...l,
              inventory: l.inventory.map(i => i.productId === productId ? { ...i, stock: Math.max(0, i.stock - quantity) } : i)
            };
          }

          // Revert Source (Add back, unless exempt or destination was Deposit)
          if (l.id === sourceLocaleId && !isExempt && destinationLocaleId !== 'deposit') {
            const hasItem = l.inventory?.some(i => i.productId === productId) ?? false;
            return {
              ...l,
              inventory: hasItem
                ? l.inventory.map(i => i.productId === productId ? { ...i, stock: i.stock + quantity } : i)
                : [...(l.inventory || []), { productId, stock: quantity }]
            };
          }
          return l;
        }));

        setTransfers(prev => prev.filter(t => t.id !== transferId));
      }
      alert("✓ Movimiento eliminado y stocks revertidos");
    } catch (err: any) {
      console.error(err);
      alert("Error completando la operación: " + err.message);
    }
  };

  const handleTransferSubmit = async () => {
    const { productId, localeId, quantity, sourceLocaleId } = transferData;
    if (!productId || !localeId || quantity <= 0) return;
    if (sourceLocaleId !== 'deposit' && sourceLocaleId === localeId) {
      alert("El origen y el destino no pueden ser el mismo.");
      return;
    }

    console.log("Starting transfer submit...");
    setIsSubmitting(true);
    try {
      if (storageMode === 'cloud') {
        const productRef = doc(db, 'products', productId);

        await runTransaction(db, async (transaction) => {
          // 1. READ ALL DATA FIRST

          // Read Product (Master Stock)
          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) throw new Error("Producto no encontrado");
          const productData = { id: productDoc.id, ...productDoc.data() } as Product;

          // Read Source Locale (if applicable)
          let sourceLocaleDoc;
          let sourceLocaleData: Locale | null = null;
          if (sourceLocaleId !== 'deposit') {
            sourceLocaleDoc = await transaction.get(doc(db, 'locales', sourceLocaleId));
            if (!sourceLocaleDoc.exists()) throw new Error("Origen no encontrado");
            sourceLocaleData = { id: sourceLocaleDoc.id, ...sourceLocaleDoc.data() } as Locale;
          }

          // Read Destination Locale (if applicable)
          let destLocaleDoc;
          let destLocaleData: Locale | null = null;
          if (localeId !== 'deposit') {
            destLocaleDoc = await transaction.get(doc(db, 'locales', localeId));
            if (!destLocaleDoc.exists()) throw new Error("Destino no encontrado");
            destLocaleData = { id: destLocaleDoc.id, ...destLocaleDoc.data() } as Locale;
          }

          // Read Dashboard Stats
          const statsRef = doc(db, 'settings', 'dashboard_stats');
          const statsDoc = await transaction.get(statsRef);

          // 2. CHECK STOCK & VALIDATE
          if (editingTransferId) {
            throw new Error("La edición de transferencias no está soportada en esta versión optimizada.");
          }

          // Check Source Stock
          if (sourceLocaleId === 'deposit') {
            if (productData.masterStock < quantity) {
              throw new Error(`Stock insuficiente en Depósito Central. Disponible: ${productData.masterStock}`);
            }
          } else {
            const item = sourceLocaleData?.inventory.find(i => i.productId === productId);
            const currentStock = item?.stock || 0;
            const isExempt = ['PRADERAS', 'DIQUE', 'SOHO', 'MARKET'].includes((sourceLocaleData?.name || '').toUpperCase());

            if (currentStock < quantity && !isExempt) {
              throw new Error(`Stock insuficiente en ${sourceLocaleData?.name}. Disponible: ${currentStock}`);
            }
          }

          // 3. PERFORM UPDATES (Writes)

          // Deduct from Source
          const isSourceExempt = sourceLocaleData && ['PRADERAS', 'DIQUE', 'SOHO', 'MARKET'].includes((sourceLocaleData.name || '').toUpperCase());

          if (sourceLocaleId === 'deposit') {
            transaction.update(productRef, { masterStock: productData.masterStock - quantity });
          } else if (!isSourceExempt) {
            if (!sourceLocaleData) throw new Error("Error interno: Datos de origen perdidos");
            const newInventory = sourceLocaleData.inventory.map(item =>
              item.productId === productId ? { ...item, stock: item.stock - quantity } : item
            );
            transaction.update(doc(db, 'locales', sourceLocaleId), { inventory: newInventory });
          }

          // Add to Destination
          if (localeId === 'deposit') {
            transaction.update(productRef, { masterStock: productData.masterStock + quantity });
          } else {
            if (!destLocaleData) throw new Error("Error interno: Datos de destino perdidos");
            const hasItem = destLocaleData.inventory?.some(i => i.productId === productId) ?? false;
            let newInventory;
            if (hasItem) {
              newInventory = destLocaleData.inventory.map(item =>
                item.productId === productId ? { ...item, stock: item.stock + quantity } : item
              );
            } else {
              newInventory = [...(destLocaleData.inventory || []), { productId, stock: quantity }];
            }
            transaction.update(doc(db, 'locales', localeId), { inventory: newInventory });
          }

          // Create Transfer History Record
          const now = new Date();
          const strictDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

          const newTransferRef = doc(collection(db, 'transfers'));
          const transferDocData = {
            date: strictDate,
            productId,
            productName: productData.name,
            quantity,
            destinationLocaleId: localeId,
            destinationLocaleName: localeId === 'deposit' ? 'Depósito Central' : (destLocaleData?.name || 'Desconocido'),
            sourceLocaleId: sourceLocaleId || 'deposit',
            sourceLocaleName: sourceLocaleId === 'deposit' ? 'Depósito Central' : (sourceLocaleData?.name || 'Local'),
            timestamp: serverTimestamp()
          };

          transaction.set(newTransferRef, transferDocData);

          // --- RECOMMENDATION 1: Update Dashboard Stats Document ---
          let currentStats = statsDoc.exists() ? statsDoc.data() : {
            distributionData: [],
            destinationComparison: []
          };

          // Update Distribution
          const distIdx = currentStats.distributionData.findIndex((d: any) => d.name === productData.name);
          if (distIdx >= 0) {
            currentStats.distributionData[distIdx].value += quantity;
          } else {
            currentStats.distributionData.push({ name: productData.name, value: quantity });
          }
          currentStats.distributionData.sort((a: any, b: any) => b.value - a.value);
          currentStats.distributionData = currentStats.distributionData.slice(0, 15);

          // Update Destination Comparison
          const destName = localeId === 'deposit' ? 'Depósito Central' : (destLocaleData?.name || 'Desconocido');
          const destIdx = currentStats.destinationComparison.findIndex((d: any) => d.destino === destName);
          if (destIdx >= 0) {
            currentStats.destinationComparison[destIdx].total += quantity;
            currentStats.destinationComparison[destIdx].movimientos += 1;
          } else {
            currentStats.destinationComparison.push({ destino: destName, total: quantity, movimientos: 1 });
          }
          currentStats.destinationComparison.sort((a: any, b: any) => b.total - a.total);

          transaction.set(statsRef, {
            ...currentStats,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        });

        // 4. UPDATE LOCAL STATE (Optimistic / Confirmation)
        // ... (This part is often skipped if we rely on listener, but for immediate feedback/offline suppport logic typically goes here)
        // Since we have listeners, we just close modal and wait for sync or do optimistic update if critical.
        // For simplicity with listeners active:
        setIsTransferModalOpen(false);
        setIsSubmitting(false);
        alert("Movimiento ejecutado");

      } else {
        // LOCAL MODE LOGIC
        // ... (existing local logic would be here, but let's assume Cloud for now as per user context usually)
        // Check Source Stock
        const sourceProduct = products.find(p => p.id === productId);
        if (!sourceProduct) return; // Should not happen

        if (sourceLocaleId === 'deposit') {
          if (sourceProduct.masterStock < quantity) {
            alert(`Stock insuficiente en Depósito Central. Disponible: ${sourceProduct.masterStock}`);
            setIsSubmitting(false);
            return;
          }
        } else {
          const sourceLocale = locales.find(l => l.id === sourceLocaleId);
          const item = sourceLocale?.inventory.find(i => i.productId === productId);
          const isExempt = ['PRADERAS', 'DIQUE', 'SOHO', 'MARKET'].includes((sourceLocale?.name || '').toUpperCase());

          if ((item?.stock || 0) < quantity && !isExempt) {
            alert(`Stock insuficiente en ${sourceLocale?.name}`);
            setIsSubmitting(false);
            return;
          }
        }

        // Update State manually
        setProducts(prev => prev.map(p =>
          p.id === productId && sourceLocaleId === 'deposit' ? { ...p, masterStock: p.masterStock - quantity } :
            (p.id === productId && localeId === 'deposit' ? { ...p, masterStock: p.masterStock + quantity } : p)
        ));

        setLocales(prev => prev.map(l => {
          // Deduct from source
          // Deduct from source
          if (l.id === sourceLocaleId) {
            if (['PRADERAS', 'DIQUE', 'SOHO', 'MARKET'].includes((l.name || '').toUpperCase())) return l;
            return { ...l, inventory: l.inventory.map(i => i.productId === productId ? { ...i, stock: i.stock - quantity } : i) };
          }
          // Add to dest
          if (l.id === localeId) {
            const hasItem = l.inventory?.some(i => i.productId === productId) ?? false;
            return {
              ...l, inventory: hasItem
                ? l.inventory.map(i => i.productId === productId ? { ...i, stock: i.stock + quantity } : i)
                : [...(l.inventory || []), { productId, stock: quantity }]
            };
          }
          return l;
        }));

        const now = new Date();
        const newTransfer: Transfer = {
          id: Date.now().toString(),
          date: now.toLocaleString(),
          productId,
          productName: products.find(p => p.id === productId)?.name || 'Unknown',
          quantity,
          destinationLocaleId: localeId,
          destinationLocaleName: localeId === 'deposit' ? 'Depósito Central' : locales.find(l => l.id === localeId)?.name || 'Unknown',
          sourceLocaleId: sourceLocaleId,
          sourceLocaleName: sourceLocaleId === 'deposit' ? 'Depósito Central' : locales.find(l => l.id === sourceLocaleId)?.name || 'Unknown'
        };
        setTransfers(prev => [newTransfer, ...prev]);
        setIsTransferModalOpen(false);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
      setIsSubmitting(false);
    }
  };

  const openNewProduct = (initialCategory?: string) => {
    setEditingProduct(null);
    setProductData({
      sku: '',
      name: '',
      category: (typeof initialCategory === 'string' ? initialCategory : ''),
      masterStock: 0,
      expirationDate: '',
      additionalSkus: []
    });
    setIsProductModalOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      masterStock: product.masterStock,
      expirationDate: product.expirationDate || '',
      additionalSkus: product.additionalSkus || []
    });
    setIsProductModalOpen(true);
  };



  const handleProductSubmit = async () => {
    const { sku, name, category, masterStock, expirationDate, additionalSkus } = productData;
    if (!sku || !name || !category) return;

    try {
      if (storageMode === 'cloud') {
        if (editingProduct) {
          await updateDoc(doc(db, 'products', editingProduct.id), { sku, name, category, masterStock, expirationDate, additionalSkus });
        } else {
          const newId = Math.random().toString(36).substr(2, 9);
          await setDoc(doc(db, 'products', newId), { id: newId, sku, name, category, masterStock, expirationDate, additionalSkus });
        }

      } else {
        if (editingProduct) {
          setProducts(prev => prev.map(p =>
            p.id === editingProduct.id ? { ...p, sku, name, category, masterStock, expirationDate, additionalSkus } : p
          ));
        } else {
          const newProduct: Product = {
            id: Math.random().toString(36).substr(2, 9),
            sku,
            name,
            category,
            masterStock,
            expirationDate,
            additionalSkus
          };
          setProducts(prev => [...prev, newProduct]);
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar el producto: " + (error instanceof Error ? error.message : String(error)));
      return; // Keep modal open
    }



    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el producto "${product.name}"?`)) return;

    if (storageMode === 'cloud') {
      await deleteDoc(doc(db, 'products', product.id));
    } else {
      setProducts(prev => prev.filter(p => p.id !== product.id));
    }
  };

  const getProductStockInLocale = (productId: string, locale: Locale) => {
    return locale.inventory?.find(item => item.productId === productId)?.stock || 0;
  };

  const totalItemsMaster = products.reduce((acc, p) => acc + p.masterStock, 0);
  const totalItemsLocales = locales.reduce((acc, l) => acc + (l.inventory?.reduce((sub, item) => sub + item.stock, 0) || 0), 0);

  const filteredProducts = products.filter(p => {
    let matches = matchesSearch(p, searchTerm);
    if (selectedCategory !== 'all') matches = matches && p.category === selectedCategory;
    if (view === 'master' && showCriticalOnly) matches = matches && p.masterStock < 10;
    if (view === 'master' && showExpirationOnly) {
      if (!p.expirationDate) {
        matches = false;
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [yExp, mExp, dExp] = p.expirationDate.split('-').map(Number);
        const exp = new Date(yExp, mExp - 1, dExp);
        const timeDiff = exp.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        matches = matches && daysDiff <= 30;
      }
    }
    return matches;
  });

  // --- History Filtering Logic ---
  const getTransferDateObject = (dateStr: string) => {
    // Format is "DD/MM/YYYY, HH:MM:SS" or similar local string
    try {
      const parts = dateStr.split(',')[0].trim().split('/'); // [DD, MM, YYYY]
      if (parts.length === 3) {
        // Note: Month is 0-indexed in JS Date
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      return new Date(dateStr); // Fallback
    } catch (e) {
      return new Date();
    }
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const tDate = getTransferDateObject(t.date);
      // Reset time for comparison
      tDate.setHours(0, 0, 0, 0);

      let dateMatch = true;

      if (historyFilterMode === 'date') {
        if (historySingleDate) {
          const [sy, sm, sd] = historySingleDate.split('-').map(Number);
          const sDate = new Date(sy, sm - 1, sd);
          // Compare timestamps for exact day match
          dateMatch = tDate.getTime() === sDate.getTime();
        }
      } else {
        // Range Mode Logic
        let afterStart = true;
        let beforeEnd = true;

        if (historyFilterStart) {
          const [sy, sm, sd] = historyFilterStart.split('-').map(Number);
          const sDate = new Date(sy, sm - 1, sd);
          afterStart = tDate >= sDate;
        }

        if (historyFilterEnd) {
          const [ey, em, ed] = historyFilterEnd.split('-').map(Number);
          const eDate = new Date(ey, em - 1, ed);
          beforeEnd = tDate <= eDate;
        }

        dateMatch = afterStart && beforeEnd;
      }

      const matchesLocale = historyFilterLocale ? t.destinationLocaleId === historyFilterLocale : true;

      // Search Term Filter
      let matchesSearch = true;
      if (historySearchTerm.trim()) {
        const term = historySearchTerm.toLowerCase().trim();
        matchesSearch = (t.productName || '').toLowerCase().includes(term);
      }

      return dateMatch && matchesLocale && matchesSearch;
    }).sort((a, b) => {
      const parseDateTime = (str: string) => {
        try {
          const parts = str.split(',');
          const datePart = parts[0].trim();
          const timePart = parts[1]?.trim();
          const [d, m, y] = datePart.split('/').map(Number);
          if (timePart) {
            const [hh, mm, ss] = timePart.split(':').map(Number);
            return new Date(y, m - 1, d, hh, mm, ss).getTime();
          }
          return new Date(y, m - 1, d).getTime();
        } catch (e) {
          return 0;
        }
      };
      return parseDateTime(b.date) - parseDateTime(a.date);
    });
  }, [transfers, historyFilterMode, historySingleDate, historyFilterStart, historyFilterEnd, selectedCategory, products, historyFilterLocale, historySearchTerm]);

  const handleAddLocale = async () => {
    if (!newLocaleName.trim()) return;

    if (storageMode === 'cloud') {
      const newId = `locale-${Date.now()}`; // Simple unique ID
      const newLocale: Locale = {
        id: newId,
        name: newLocaleName,
        inventory: []
      };
      await setDoc(doc(db, 'locales', newId), newLocale);
    } else {
      const newId = `locale-${Date.now()}`;
      const newLocale: Locale = {
        id: newId,
        name: newLocaleName,
        inventory: []
      };
      setLocales(prev => [...prev, newLocale]);
    }

    setNewLocaleName('');
    setIsNewLocaleModalOpen(false);
  };

  const handleDeleteLocale = async (localeId: string) => {
    if (!window.confirm("¿Eliminar este destino? Se perderá el historial asociado en futuras referencias localmente (no elimina logs pasados).")) return;

    if (storageMode === 'cloud') {
      // Check if it has inventory? User said "simplify", so strict checks might be annoying, but safer. 
      // User said: "solo quiero crear sucursales para agregar un punto de destino". So Inventory is irrelevant/hidden.
      await deleteDoc(doc(db, 'locales', localeId));
    } else {
      setLocales(prev => prev.filter(l => l.id !== localeId));
    }
  };

  const handleRenameLocale = async (localeId: string, currentName: string) => {
    console.log('🔧 handleRenameLocale called:', { localeId, currentName, storageMode });
    const newName = prompt("Nuevo nombre para el destino:", currentName);
    console.log('📝 User entered:', newName);

    if (!newName || newName.trim() === currentName) {
      console.log('❌ Rename cancelled or same name');
      return;
    }

    console.log('✅ Proceeding with rename to:', newName);

    if (storageMode === 'cloud') {
      console.log('☁️ Updating Firestore...');
      // Use setDoc with merge to create document if it doesn't exist
      // Include inventory field to prevent crashes
      const currentLocale = locales.find(l => l.id === localeId);
      await setDoc(doc(db, 'locales', localeId), {
        name: newName,
        inventory: currentLocale?.inventory || []
      }, { merge: true });
      console.log('✅ Firestore updated');
    } else {
      console.log('💾 Updating local state...');
      setLocales(prev => {
        const updated = prev.map(l => l.id === localeId ? { ...l, name: newName } : l);
        console.log('📊 New locales state:', updated);
        return updated;
      });
    }
  };

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim().toUpperCase();
    if (!trimmedName) return;

    // Check if category already exists
    if (categories.includes(trimmedName)) {
      alert('Esta categoría ya existe');
      return;
    }

    setCustomCategories(prev => {
      const updated = [...prev, trimmedName];
      if (storageMode === 'cloud') {
        const uniqueCategories = [...new Set(updated)]; // Ensure uniqueness just in case
        setDoc(doc(db, 'settings', 'categories'), { customCategories: uniqueCategories }, { merge: true })
          .catch(err => console.error("Error saving category:", err));
      }
      return updated;
    });
    setNewCategoryName('');
    setIsNewCategoryModalOpen(false);
  };

  const handleDeleteCategory = (category: string) => {
    if (confirm(`¿Eliminar la categoría "${category}"? Se actualizarán los productos a "Sin Categoría".`)) {

      // 1. Remove from customCategories
      setCustomCategories(prev => {
        const newCategories = prev.filter(c => c !== category);
        if (storageMode === 'cloud') {
          setDoc(doc(db, 'settings', 'categories'), { customCategories: newCategories }, { merge: true })
            .catch(err => console.error("Error deleting category:", err));
        }
        return newCategories;
      });

      // 2. Update all products in that category to 'Uncategorized' (or just remove category?)
      // We'll set them to something explicit if we want to be clean.
      // But for now, let's just update products.
      if (storageMode === 'cloud') {
        // Batch update would be best, or individual.
        products.filter(p => p.category === category).forEach(async p => {
          await updateDoc(doc(db, 'products', p.id), { category: 'VARIOS' });
        });
      } else {
        setProducts(prev => prev.map(p =>
          p.category === category ? { ...p, category: 'VARIOS' } : p
        ));
      }

      if (selectedManagementCategory === category) setSelectedManagementCategory(null);
    }
  };

  const handleEditCategory = (oldName: string) => {
    const newName = prompt("Nuevo nombre para la categoría:", oldName);
    if (!newName || newName === oldName) return;

    const trimmedName = newName.toUpperCase().trim();
    if (categories.includes(trimmedName) && !customCategories.includes(trimmedName)) {
      alert("Ese nombre ya existe como categoría del sistema.");
      return;
    }

    // 1. Update customCategories list
    setCustomCategories(prev => {
      const updated = prev.map(c => c === oldName ? trimmedName : c);
      if (storageMode === 'cloud') {
        setDoc(doc(db, 'settings', 'categories'), { customCategories: updated }, { merge: true })
          .catch(err => console.error("Error renaming category:", err));
      }
      return updated;
    });

    // 2. Update products
    if (storageMode === 'cloud') {
      products.filter(p => p.category === oldName).forEach(async p => {
        await updateDoc(doc(db, 'products', p.id), { category: trimmedName });
      });
    } else {
      setProducts(prev => prev.map(p =>
        p.category === oldName ? { ...p, category: trimmedName } : p
      ));
    }

    if (selectedManagementCategory === oldName) setSelectedManagementCategory(trimmedName);
  };

  const handleExportData = () => {
    const data = {
      products,
      locales,
      transfers,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deposito-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHistoryCSV = () => {
    if (filteredTransfers.length === 0) {
      alert("No hay historial para exportar con el filtro actual.");
      return;
    }

    // CSV Header
    const headers = ["Fecha", "Producto", "Cantidad", "Origen", "Destino"];

    // Map data to CSV rows
    const rows = filteredTransfers.map(t => [
      // Formatting date removing commas for CSV safety if needed, though simple replacement works
      `"${t.date}"`,
      `"${t.productName}"`,
      t.quantity,
      "Depósito Central",
      `"${t.destinationLocaleName}"`
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-movimientos-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHistoryPDF = () => {
    const doc = new jsPDF();

    // Header Color Base
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(0, 0, 210, 40, 'F');

    // Logo Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPOSITO', 20, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('CLOUD LOGISTIC', 20, 26);

    doc.text(`Generado: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 35);

    // Title
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte de Movimientos', 20, 55);

    // Filter Info
    if (historyFilterStart || historyFilterEnd || selectedCategory !== 'all' || historyFilterLocale) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate 500
      let filterText = 'Filtro: ';
      if (historyFilterStart) filterText += `Desde ${historyFilterStart.split('-').reverse().join('/')} `;
      if (historyFilterEnd) filterText += `Hasta ${historyFilterEnd.split('-').reverse().join('/')} `;
      if (historyFilterLocale) {
        const localeName = locales.find(l => l.id === historyFilterLocale)?.name || 'Desconocido';
        filterText += `| Destino: ${localeName} `;
      }
      if (selectedCategory !== 'all') filterText += `| Rubro: ${selectedCategory.toUpperCase()} `;
      if (historySearchTerm) filterText += `| Buscando: "${historySearchTerm}"`;
      doc.text(filterText, 20, 62);
    }

    // Table
    const tableData = filteredTransfers.map(t => [
      t.date,
      t.productName,
      t.quantity.toString(),
      t.destinationLocaleName
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Fecha', 'Producto', 'Cant.', 'Destino']],
      body: tableData,
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { top: 70 },
    });

    doc.save(`historial_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleClearHistory = async () => {
    if (filteredTransfers.length === 0) return;

    const confirmMessage = historyFilterStart || historyFilterEnd || selectedCategory !== 'all' || historySearchTerm
      ? `¿Estás seguro de ELIMINAR los ${filteredTransfers.length} movimientos filtrados? Esta acción es permanente y NO se puede deshacer.`
      : `⚠️ ATENCIÓN: ¿Estás seguro de vaciar TODO el historial (${filteredTransfers.length} movimientos)?\n\nEsta acción es permanente y NO afecta al stock, solo elimina el registro histórico.`;

    if (!window.confirm(confirmMessage)) return;

    if (storageMode === 'cloud') {
      try {
        // Batch delete (limit 500 per batch)
        const batchSize = 500;
        const chunks = [];
        for (let i = 0; i < filteredTransfers.length; i += batchSize) {
          chunks.push(filteredTransfers.slice(i, i + batchSize));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(t => {
            const ref = doc(db, 'transfers', t.id);
            batch.delete(ref);
          });
          await batch.commit();
        }
        alert("Historial eliminado correctamente.");
      } catch (error) {
        console.error("Error borrar historial:", error);
        alert("Error al borrar historial. Revisa la consola.");
      }
    } else {
      const idsToDelete = new Set(filteredTransfers.map(t => t.id));
      setTransfers(prev => prev.filter(t => !idsToDelete.has(t.id)));
      alert("Historial local eliminado.");
    }
  };

  const handleExportProductsCSV = () => {
    const headers = ['SKU', 'Nombre', 'Categoria', 'Stock', 'Vencimiento', 'Codigos Adicionales'];
    const rows = products.map(p => [
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`, // Escape quotes
      p.category,
      p.masterStock,
      p.expirationDate || '',
      p.additionalSkus ? `"${p.additionalSkus.join(', ')}"` : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `productos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (data.products && Array.isArray(data.products)) setProducts(data.products);
        if (data.locales && Array.isArray(data.locales)) setLocales(data.locales);
        if (data.transfers && Array.isArray(data.transfers)) setTransfers(data.transfers);

        alert("Datos importados correctamente");
      } catch (error) {
        alert("Error al importar el archivo: Formato inválido");
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  const handleImportProductsCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const lines = content.split(/\r\n|\n/);

      let newCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      // Skip header if present (heuristic: check if first row contains "SKU")
      const startIndex = lines[0].toLowerCase().includes('sku') ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parse: split by comma, remove quotes
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

        // Expected: SKU, Name, Category, Quantity
        if (parts.length < 4) {
          console.warn(`Skipping invalid line ${i + 1}: ${line}`);
          errorCount++;
          continue;
        }

        const [sku, name, category, quantityStr] = parts;
        const quantity = parseInt(quantityStr) || 0;

        if (!sku || !name) {
          errorCount++;
          continue;
        }

        const existingProduct = products.find(p => p.sku === sku);

        if (existingProduct) {
          // Update Existing
          if (quantity > 0) {
            if (storageMode === 'cloud') {
              const productRef = doc(db, 'products', existingProduct.id);
              await updateDoc(productRef, {
                masterStock: existingProduct.masterStock + quantity
              });
            } else {
              setProducts(prev => prev.map(p =>
                p.id === existingProduct.id ? { ...p, masterStock: p.masterStock + quantity } : p
              ));
            }
            updatedCount++;
          }
        } else {
          // Create New
          const newProduct: Product = {
            id: Math.random().toString(36).substr(2, 9),
            sku,
            name,
            category: category || 'General',
            masterStock: quantity
          };

          if (storageMode === 'cloud') {
            await setDoc(doc(db, 'products', newProduct.id), newProduct);
          } else {
            setProducts(prev => [...prev, newProduct]);
          }
          newCount++;
        }
      }

      alert(`Importación completada:\n- Nuevos: ${newCount}\n- Actualizados: ${updatedCount}\n- Errores/Omitidos: ${errorCount}`);
      // Force refresh if needed, but state updates should trigger render
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Export Incomes to PDF removed


  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-bold animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[100px] animate-pulse"></div>
        </div>

        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative z-10 text-center">
          <img src="/logo.png" alt="Logo" className="w-40 h-40 mx-auto mb-6 object-contain drop-shadow-2xl" />

          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Depósito</h1>
          <p className="text-slate-400 font-medium mb-8">Gestión inteligente de inventario.</p>

          <button
            onClick={handleLogin}
            className="w-full bg-white text-slate-900 p-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-95 group"
          >
            <div className="w-6 h-6 relative flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            Iniciar sesión con Google
          </button>
          <p className="text-[10px] text-slate-500 mt-6 font-semibold">
            Solo personal autorizado
          </p>
        </div>
      </div>
    );
  }

  if (!storageMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-2xl shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-500">
          <img src="/logo.png" alt="Logo" className="w-40 h-40 mx-auto mb-6 object-contain drop-shadow-xl" />

          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">Bienvenido</h1>
            <p className="text-slate-500 text-lg font-medium max-w-md mx-auto">Selecciona dónde quieres guardar tu inventario.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <button
              onClick={() => selectStorageMode('local')}
              className="group p-8 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/50 transition-all active:scale-95 text-left relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-indigo-500 group-hover:bg-indigo-500 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
              </div>
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                <Smartphone className="w-7 h-7 text-indigo-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Memoria Local</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                Datos guardados solo en este dispositivo.
                <br />
                <span className="text-emerald-500 flex items-center gap-1 mt-2"><WifiOff className="w-3 h-3" /> Sin Internet</span>
              </p>
            </button>

            <button
              onClick={() => selectStorageMode('cloud')}
              className="group p-8 rounded-[2rem] border-2 border-slate-100 hover:border-violet-500 bg-slate-50 hover:bg-violet-50/50 transition-all active:scale-95 text-left relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-violet-500 group-hover:bg-violet-500 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-transparent group-hover:text-white transition-colors" />
              </div>
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                <Cloud className="w-7 h-7 text-violet-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Nube (Online)</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                Sincronización en tiempo real.
                <br />
                <span className="text-violet-500 flex items-center gap-1 mt-2"><Wifi className="w-3 h-3" /> Requiere Internet</span>
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen pb-24 md:pb-0">


      {/* Unified Collapsible Sidebar - Desktop Only */}
      <aside className={`
        hidden md:flex md:sticky top-0 left-0 h-screen z-50 transition-all duration-300 sidebar-gradient bg-slate-900 flex-col shadow-2xl
        md:translate-x-0
        ${isSidebarCollapsed ? 'md:w-24' : 'md:w-72'}
      `}>
        {/* Sidebar Header */}
        <div className={`p-4 ${isSidebarCollapsed && !isMobileMenuOpen ? 'px-4' : 'px-6'} flex items-center justify-between`}>
          <div className="flex flex-col items-center flex-1 relative">
            {!isSidebarCollapsed || isMobileMenuOpen ? (
              <img src="/logo.png" alt="Logo" className="w-32 h-auto object-contain drop-shadow-lg transform hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <Package className="w-7 h-7 text-indigo-600" />
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          {isMobileMenuOpen && (
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute -right-4 top-10 bg-indigo-600 text-white p-1 rounded-full shadow-lg z-50 hover:bg-indigo-700 transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronRight className="w-4 h-4 rotate-180" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className={`flex-1 overflow-y-auto ${isSidebarCollapsed && !isMobileMenuOpen ? 'px-3' : 'px-6'}`}>
          <nav className="space-y-1.5">
            <SidebarItem isCollapsed={isSidebarCollapsed && !isMobileMenuOpen} icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" active={view === 'analytics'} onClick={() => { setView('analytics'); setShowCriticalOnly(false); setShowExpirationOnly(false); setIsMobileMenuOpen(false); }} />
            <SidebarItem isCollapsed={isSidebarCollapsed && !isMobileMenuOpen} icon={<Warehouse className="w-5 h-5" />} label="Stock Central" active={view === 'master'} onClick={() => { setView('master'); setShowCriticalOnly(false); setShowExpirationOnly(false); setIsMobileMenuOpen(false); }} />
            <SidebarItem isCollapsed={isSidebarCollapsed && !isMobileMenuOpen} icon={<ArrowRightLeft className="w-5 h-5" />} label="Movimientos" active={view === 'transfers'} onClick={() => { setView('transfers'); setShowCriticalOnly(false); setShowExpirationOnly(false); setIsMobileMenuOpen(false); }} />
            <SidebarItem isCollapsed={isSidebarCollapsed && !isMobileMenuOpen} icon={<History className="w-5 h-5" />} label="Historial" active={view === 'history'} onClick={() => { setView('history'); setShowCriticalOnly(false); setShowExpirationOnly(false); setIsMobileMenuOpen(false); }} />
            <SidebarItem isCollapsed={isSidebarCollapsed && !isMobileMenuOpen} icon={<MapPin className="w-5 h-5" />} label="Destinos" active={view === 'locales'} onClick={() => { setView('locales'); setShowCriticalOnly(false); setShowExpirationOnly(false); setIsMobileMenuOpen(false); }} />
            <SidebarItem isCollapsed={isSidebarCollapsed && !isMobileMenuOpen} icon={<Settings className="w-5 h-5" />} label="Gestión" active={view === 'management'} onClick={() => { setView('management'); setShowCriticalOnly(false); setShowExpirationOnly(false); setIsMobileMenuOpen(false); }} />
          </nav>


        </div>

        {/* Sidebar Footer */}
        <div className={`p-4 ${isSidebarCollapsed && !isMobileMenuOpen ? 'px-4' : 'px-6'} space-y-2`}>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className={`w-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 font-bold py-2.5 rounded-xl flex items-center justify-center transition-all border border-slate-700/50 ${isSidebarCollapsed && !isMobileMenuOpen ? '' : 'gap-2'}`}
            title="Ajustes"
          >
            <Settings className="w-5 h-5" />
            {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="text-xs">Ajustes</span>}
          </button>

          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className={`w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] shadow-xl mb-3`}
              title="Instalar Aplicación"
            >
              <Laptop className="w-5 h-5 text-indigo-200" />
              {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Instalar App</span>}
            </button>
          )}

          <button

            onClick={openNewTransfer}
            className={`w-full bg-white text-slate-900 font-bold py-3 rounded-2xl flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] shadow-xl`}
          >
            <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
            {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Transferencia</span>}
          </button>

          {/* User Profile */}
          {(!isSidebarCollapsed || isMobileMenuOpen) && (
            <div className="pt-4 border-t border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-black text-xs">
                  {user?.email?.[0].toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Usuario'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-12 overflow-y-auto max-w-[1600px] mx-auto w-full">
        {/* Mobile Header (Sticky on top) */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 md:mb-12 gap-6">
          <div className="flex items-center justify-between md:block">
            <div>
              <img src="/logo.png" alt="Logo" className="h-12 w-auto mb-4 object-contain md:hidden drop-shadow-md" />
              <div className="flex items-center space-x-2 mb-1 md:mb-2">
                <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 ${storageMode === 'cloud' ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-600'}`}>
                  {storageMode === 'cloud' ? <><Cloud className="w-3 h-3" /> Nube</> : <><Smartphone className="w-3 h-3" /> Local</>}
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {view === 'master' && 'Depósito'}
                {view === 'analytics' && 'Resumen'}
                {view.startsWith('locale') && locales.find(l => l.id === view.replace('locale-', ''))?.name}
                {view === 'history' && 'Logs'}
                {view === 'management' && 'Gestión'}
              </h2>
              {view === 'master' && showCriticalOnly && (
                <button
                  onClick={() => setShowCriticalOnly(false)}
                  className="mt-2 flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-xs font-bold uppercase cursor-pointer hover:bg-rose-200 transition-colors w-fit"
                >
                  <AlertCircle className="w-3 h-3" /> Filtro: Críticos <X className="w-3 h-3 ml-1" />
                </button>
              )}
              {view === 'master' && showExpirationOnly && (
                <button
                  onClick={() => setShowExpirationOnly(false)}
                  className="mt-2 flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-600 rounded-lg text-xs font-bold uppercase cursor-pointer hover:bg-amber-200 transition-colors w-fit"
                >
                  <Calendar className="w-3 h-3" /> Filtro: Vencimientos <X className="w-3 h-3 ml-1" />
                </button>
              )}
            </div>

          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            {view === 'master' && (
              <button
                onClick={() => openNewProduct()}
                className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Nuevo Producto</span>
              </button>
            )}
            {(view === 'master' || (view.startsWith('locale') && view !== 'locales')) && (
              <div className="w-full md:w-auto relative group flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-3 pr-8 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all outline-none appearance-none cursor-pointer hover:bg-slate-100 shrink-0 w-32 md:w-36 truncate"
                >
                  <option value="all">Todas</option>
                  {categories.filter(c => c !== 'all').map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <div className="relative w-full md:w-96">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 md:py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 shadow-sm transition-all"
                  />
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Escanear código de barras"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="space-y-6 md:space-y-10">
          {view === 'analytics' && (
            <div className="space-y-6 md:space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                <StatCard icon={<Package className="w-5 h-5 md:w-6 md:h-6" />} label="Maestro" value={totalItemsMaster} color="text-indigo-600" bgColor="bg-indigo-500" />
                <StatCard icon={<Layers className="w-5 h-5 md:w-6 md:h-6" />} label="Destinos" value={locales.length} color="text-emerald-600" bgColor="bg-emerald-500" />
                <StatCard
                  icon={<AlertCircle className="w-5 h-5 md:w-6 md:h-6" />}
                  label="Crítico"
                  value={products.filter(p => p.masterStock < 10).length}
                  color="text-rose-600"
                  bgColor="bg-rose-500"
                  onClick={() => { setView('master'); setShowCriticalOnly(true); setShowExpirationOnly(false); }}
                />
                <StatCard
                  icon={<AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />}
                  label="Por Vencer"
                  value={products.filter(p => {
                    if (!p.expirationDate) return false;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const [y, m, d] = p.expirationDate.split('-').map(Number);
                    const exp = new Date(y, m - 1, d);
                    const daysDiff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    return daysDiff <= 30;
                  }).length}
                  color="text-amber-600"
                  bgColor="bg-amber-500"
                  onClick={() => { setView('master'); setShowExpirationOnly(true); setShowCriticalOnly(false); }}
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5 md:w-6 md:h-6" />}
                  label="Transf. Hoy"
                  value={transfers.filter(t => {
                    const now = new Date();
                    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                    const tDate = t.date.split(',')[0].trim();
                    return tDate === todayStr;
                  }).length}
                  color="text-violet-600"
                  bgColor="bg-violet-500"
                  onClick={() => setView('history')}
                />
              </div>

              {/* Alertas Section - Moved to top */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                <Card title="Alertas de Stock" className="lg:col-span-6">
                  <div className="space-y-5 md:space-y-6">
                    {products.sort((a, b) => a.masterStock - b.masterStock).slice(0, 5).map(p => (
                      <div key={p.id}>
                        <div className="flex items-center justify-between mb-1.5 md:mb-2">
                          <span className="text-xs md:text-sm font-bold text-slate-800 truncate mr-4">{p.name}</span>
                          <span className={`text-[10px] md:text-xs font-black shrink-0 ${p.masterStock < 10 ? 'text-rose-500' : 'text-slate-400'}`}>
                            {p.masterStock} un.
                          </span>
                        </div>
                        <div className="w-full bg-slate-50 rounded-full h-2.5 md:h-3 overflow-hidden border border-slate-100 p-0.5">
                          <div className={`h-full rounded-full ${p.masterStock < 10 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((p.masterStock / 100) * 100, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Próximos Vencimientos" className="lg:col-span-6">
                  <div className="space-y-4">
                    {products
                      .filter(p => p.expirationDate)
                      .sort((a, b) => (new Date(a.expirationDate!).getTime()) - (new Date(b.expirationDate!).getTime()))
                      .slice(0, 5)
                      .map(p => {
                        if (!p.expirationDate) return null;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const [yVenc, mVenc, dVenc] = p.expirationDate.split('-').map(Number);
                        const exp = new Date(yVenc, mVenc - 1, dVenc);
                        const timeDiff = exp.getTime() - today.getTime();
                        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        const isAlert = daysDiff <= 10;
                        const isExpired = daysDiff < 0;

                        return (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="min-w-0 pr-4">
                              <h5 className="text-xs font-bold text-slate-900 truncate">{p.name}</h5>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.expirationDate.split('-').reverse().join('/')}</p>
                            </div>
                            <span className={`shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${isExpired ? 'bg-rose-100 text-rose-600' : isAlert ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                              {(isAlert || isExpired) && <AlertTriangle className="w-3 h-3" />}
                              {isExpired ? 'Vencido' : `${daysDiff} días`}
                            </span>
                          </div>
                        );
                      })}
                    {products.filter(p => p.expirationDate).length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs font-medium">No hay fechas registradas</div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                {/* Product Distribution Pie Chart */}
                <Card title="Distribución de Productos" className="">
                  {analyticsData.distributionData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.distributionData}
                            cx="50%"
                            cy="50%"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, x, y }) => {
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="#64748b"
                                  textAnchor={x > cx ? 'start' : 'end'}
                                  dominantBaseline="central"
                                  style={{
                                    fontSize: '10px', // Smaller font size
                                    fontWeight: 'bold',
                                    fill: '#475569'
                                  }}
                                >
                                  {`${name.substring(0, 15)}${name.length > 15 ? '...' : ''}: ${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            labelLine={true} // Enable lines to better guide to the label
                          >
                            {analyticsData.distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
                      <div className="text-center">
                        <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No hay datos de transferencias</p>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Top Products */}
                <Card title="Top Productos" className="col-span-1">
                  {analyticsData.distributionData.length > 0 ? (
                    <div className="space-y-4">
                      {analyticsData.distributionData.slice(0, 5).map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 ${index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-100 text-slate-600' : index === 2 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
                              {index + 1}
                            </span>
                            <span className="text-sm font-bold text-slate-700 truncate">{item.name}</span>
                          </div>
                          <span className="text-sm font-black text-indigo-600 shrink-0 ml-4">{item.value} <span className="text-[9px] text-slate-400 uppercase">u.</span></span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
                      <div className="text-center">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No hay datos de productos</p>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Destination Comparison */}
                <Card title="Comparación por Destino" className="">
                  {analyticsData.destinationComparison.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.destinationComparison}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="destino" tick={{ fontSize: 11, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                          <Bar dataKey="total" fill="#4F46E5" name="Total Unidades" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="movimientos" fill="#10B981" name="Movimientos" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No hay destinos con transferencias</p>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Transfer Trends */}
                <Card
                  title={`Tendencia de Transferencias (${trendInterval === 'weekly' ? '7 días' : '30 días'})`}
                  headerAction={
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => setTrendInterval('weekly')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${trendInterval === 'weekly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Semana
                      </button>
                      <button
                        onClick={() => setTrendInterval('monthly')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${trendInterval === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Mes
                      </button>
                    </div>
                  }
                  className="lg:col-span-2"
                >
                  {analyticsData.trendData?.some(d => (d.cantidad ?? 0) > 0) ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                          <Line
                            type="monotone"
                            dataKey="cantidad"
                            stroke="#4F46E5"
                            strokeWidth={3}
                            dot={{ fill: '#4F46E5', r: 4 }}
                            activeDot={{ r: 6 }}
                            name="Unidades Transferidas"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
                      <div className="text-center">
                        <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        <p>No hay datos de tendencias</p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Top Products by Destination */}
              {analyticsData?.topProductsByDestination?.some(d => (d?.products?.length ?? 0) > 0) && (
                <Card title="Top Productos por Destino" className="">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {analyticsData.topProductsByDestination
                      .filter(d => d.products.length > 0)
                      .map((destination, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-indigo-600" />
                            </div>
                            <h4 className="font-black text-slate-900 text-sm">{destination.localeName}</h4>
                          </div>
                          <div className="space-y-3">
                            {destination.products.map((product, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-black text-slate-400 shrink-0">#{pIdx + 1}</span>
                                  <span className="text-xs font-bold text-slate-700 truncate">{product.name}</span>
                                </div>
                                <span className="px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-black shrink-0 ml-2">
                                  {product.total}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {view === 'management' && (
            <div className="flex flex-col lg:flex-row gap-6 md:gap-8 h-[calc(100vh-140px)]">
              {/* Left Column: Categories */}
              <div className="w-full lg:w-1/3 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-50">
                  <h3 className="text-xl font-black text-slate-900 mb-1">Rubros</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gestión de categorías</p>
                  <button
                    onClick={() => setIsNewCategoryModalOpen(true)}
                    className="mt-6 w-full py-3 px-4 bg-slate-50 text-indigo-600 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 border border-indigo-100/50"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Rubro
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {categories.filter(c => c !== 'all').map(cat => {
                    const isSystem = !customCategories.includes(cat);
                    const isSelected = selectedManagementCategory === cat;
                    return (
                      <div
                        key={cat}
                        onClick={() => setSelectedManagementCategory(cat)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all border flex items-center justify-between group ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                      >
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-700'}`}>{cat}</span>
                        <div className="flex items-center gap-1">
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                              className={`p-1.5 rounded-lg transition-all ${isSelected ? 'text-white/70 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                              className={`p-1.5 rounded-lg transition-all ${isSelected ? 'text-white/70 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Products */}
              <div className="w-full lg:w-2/3 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                {selectedManagementCategory ? (
                  <>
                    <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 mb-1">{selectedManagementCategory}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Productos en esta categoría</p>
                      </div>
                      <button
                        onClick={() => openNewProduct(selectedManagementCategory)}
                        className="py-3 px-6 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                      >
                        <Plus className="w-4 h-4" /> Nuevo Producto
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                      {products.filter(p => p.category === selectedManagementCategory).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {products.filter(p => p.category === selectedManagementCategory).map(p => (
                            <div key={p.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-100 transition-all group relative">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">{p.sku}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditProduct(p)} className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDeleteProduct(p)} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </div>
                              <h4 className="font-bold text-slate-800 mb-1 truncate">{p.name}</h4>
                              <div className="flex items-center gap-2 mt-3">
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{p.masterStock} un.</span>
                                {p.additionalSkus && p.additionalSkus.length > 0 && (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">+{p.additionalSkus.length} SKUs</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
                          <Package className="w-16 h-16" />
                          <p className="font-bold text-sm">No hay productos en esta categoría</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                      <Boxes className="w-10 h-10 opacity-20" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-lg font-bold text-slate-600 mb-2">Selecciona un Rubro</h4>
                      <p className="text-sm font-medium opacity-60 max-w-xs mx-auto">Elige una categoría de la izquierda para gestionar sus productos.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table View (Desktop) / Card View (Mobile) */}
          {(view === 'master' || (view.startsWith('locale') && view !== 'locales')) && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {(() => {
                const isLocaleView = view.startsWith('locale');
                return (
                  <>
                    {/* Mobile Cards */}
                    {/* Mobile Cards */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {filteredProducts.map(p => {
                        const stock = isLocaleView
                          ? getProductStockInLocale(p.id, locales.find(l => l.id === view.replace('locale-', ''))!)
                          : p.masterStock;

                        const isLowStock = stock <= 5;

                        return (
                          <div key={p.id} className={`bg-white p-5 rounded-3xl border shadow-sm flex items-center justify-between ${isLowStock ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`}>
                            <div className="min-w-0 pr-4">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{p.sku}</p>
                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {p.name}
                                {p.additionalSkus && p.additionalSkus.length > 0 && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    +{p.additionalSkus.length}
                                  </span>
                                )}
                              </h4>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="inline-block px-2 py-0.5 bg-slate-50 text-[9px] font-bold text-slate-500 rounded-lg border border-slate-100 uppercase">
                                  {p.category}
                                </span>
                                {p.expirationDate && (
                                  (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const expDate = new Date(p.expirationDate);
                                    expDate.setHours(0, 0, 0, 0); // Treat as UTC usually in input type=date, but good to normalize
                                    // Actually input type=date value is YYYY-MM-DD. Let's parse strictly to be safe with timezones
                                    const [yCard, mCard, dCard] = p.expirationDate.split('-').map(Number);
                                    const exp = new Date(yCard, mCard - 1, dCard);

                                    const timeDiff = exp.getTime() - today.getTime();
                                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                    const isAlert = daysDiff <= 10;
                                    const isExpired = daysDiff < 0;

                                    return (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-lg border uppercase ${isExpired ? 'bg-rose-100 text-rose-600 border-rose-200' : isAlert ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                        {(isAlert || isExpired) && <AlertTriangle className="w-3 h-3" />}
                                        {!isAlert && !isExpired && <Calendar className="w-3 h-3" />}
                                        {isExpired ? 'Vencido' : `${daysDiff} días`}
                                      </span>
                                    );
                                  })()
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-center shrink-0">
                              <span className={`text-xl font-black ${stock <= 5 ? 'text-rose-600' : stock < 10 ? 'text-amber-500' : 'text-indigo-600'}`}>{stock}</span>
                              <span className={`text-[9px] font-black uppercase ${stock <= 5 ? 'text-rose-400' : 'text-slate-400'}`}>Stock</span>
                              {!isLocaleView && (
                                <div className="flex space-x-2 mt-2">
                                  <button onClick={() => openEditProduct(p)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDeleteProduct(p)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block">
                      <Card noPadding>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                              <tr>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimiento</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                {!isLocaleView && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredProducts.map(p => {
                                const stock = isLocaleView
                                  ? getProductStockInLocale(p.id, locales.find(l => l.id === view.replace('locale-', ''))!)
                                  : p.masterStock;
                                const isLowStock = stock <= 5;
                                return (
                                  <tr key={p.id} className={`transition-colors group ${isLowStock ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-slate-50'}`}>
                                    <td className="px-8 py-6 font-mono text-xs text-slate-500 font-bold">{p.sku}</td>
                                    <td className="px-8 py-6 font-bold text-slate-900">
                                      {p.name}
                                      {p.additionalSkus && p.additionalSkus.length > 0 && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wide" title={`Códigos extra: ${p.additionalSkus.join(', ')}`}>
                                          +{p.additionalSkus.length} SKUs
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-8 py-6">
                                      <span className="px-3 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg uppercase">{p.category}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                      {p.expirationDate ? (() => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const [yTable, mTable, dTable] = p.expirationDate.split('-').map(Number);
                                        const exp = new Date(yTable, mTable - 1, dTable);

                                        const timeDiff = exp.getTime() - today.getTime();
                                        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                                        const isAlert = daysDiff <= 10;
                                        const isExpired = daysDiff < 0;

                                        return (
                                          <div className="flex items-center gap-2">
                                            <span className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase ${isExpired ? 'bg-rose-100 text-rose-600 border border-rose-200' : isAlert ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                              {(isAlert || isExpired) && <AlertTriangle className="w-3 h-3" />}
                                              {daysDiff <= 365 ? (
                                                isExpired ? `Vencido (${Math.abs(daysDiff)}d)` : `${daysDiff} días`
                                              ) : p.expirationDate}
                                            </span>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{p.expirationDate.split('-').reverse().join('/')}</span>
                                          </div>
                                        );
                                      })() : <span className="text-slate-300 text-xs">-</span>}
                                    </td>
                                    <td className={`px-8 py-6 text-center font-black text-lg ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>{stock}</td>
                                    <td className="px-8 py-6 text-center">
                                      <span className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${stock <= 5 ? 'bg-rose-100 text-rose-600 border border-rose-200' : stock < 10 ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'}`}>
                                        {stock <= 5 ? 'CRÍTICO' : stock < 10 ? 'BAJO' : 'OK'}
                                      </span>
                                    </td>
                                    {!isLocaleView && (
                                      <td className="px-8 py-6 text-right space-x-2">
                                        <button onClick={() => openEditProduct(p)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteProduct(p)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {view === 'transfers' && (
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 md:p-8 rounded-3xl border border-indigo-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                    <ArrowRightLeft className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900">Gestión de Movimientos</h2>
                    <p className="text-xs md:text-sm text-slate-500 font-semibold">Transfiere productos entre ubicaciones</p>
                  </div>
                </div>
              </div>

              <Card title="Ejecutar Movimiento" className="">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Source Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">Origen</h3>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicación de Origen</label>
                      <select
                        className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        value={transferData.sourceLocaleId || 'deposit'}
                        onChange={(e) => {
                          const newSource = e.target.value;
                          setTransferData(prev => ({
                            ...prev,
                            sourceLocaleId: newSource,
                            // Clear destination if same as source
                            localeId: prev.localeId === newSource ? '' : prev.localeId,
                            // Clear product when changing source
                            productId: ''
                          }));
                        }}
                      >
                        <option value="deposit">Depósito Central</option>
                        {locales.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    {transferData.sourceLocaleId === 'deposit' && (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Stock Disponible</p>
                        <p className="text-2xl font-black text-emerald-700">
                          {products.find(p => p.id === transferData.productId)?.masterStock || 0} unidades
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Destination Column */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Store className="w-4 h-4 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">Destino</h3>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicación de Destino</label>
                      <select
                        className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        value={transferData.localeId}
                        onChange={(e) => setTransferData({ ...transferData, localeId: e.target.value })}
                      >
                        <option value="">Seleccionar destino...</option>
                        <option value="deposit" disabled={transferData.sourceLocaleId === 'deposit'}>Depósito Central</option>
                        {locales.map(l => (
                          <option key={l.id} value={l.id} disabled={transferData.sourceLocaleId === l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Product and Quantity Selection */}
                <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</label>
                        <button
                          type="button"
                          onClick={() => setIsScannerOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          Escanear
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar o escribir producto..."
                          className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                          value={transferSearchTerm}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTransferSearchTerm(val);
                            setShowTransferSuggestions(true);
                            if (val === '') {
                              setTransferData(prev => ({ ...prev, productId: '' }));
                            }
                          }}
                          onFocus={() => setShowTransferSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowTransferSuggestions(false), 200)}
                        />

                        {/* Autocomplete Suggestions */}
                        {showTransferSuggestions && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar left-0">
                            {getFilteredTransferProducts(products, transferSearchTerm, transferCategoryFilter).length > 0 ? (
                              getFilteredTransferProducts(products, transferSearchTerm, transferCategoryFilter)
                                .map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setTransferData(prev => ({ ...prev, productId: p.id }));
                                      setTransferSearchTerm(p.name);
                                      setTransferCategoryFilter(p.category);
                                      setShowTransferSuggestions(false);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-b-0 flex justify-between items-center group"
                                  >
                                    <div>
                                      <div className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">{p.name}</div>
                                      <div className="text-[10px] font-bold text-slate-400 uppercase">{p.sku}</div>
                                    </div>
                                    <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-600">
                                      Stock: {transferData.sourceLocaleId === 'deposit'
                                        ? p.masterStock
                                        : (locales.find(l => l.id === transferData.sourceLocaleId)?.inventory?.find(i => i.productId === p.id)?.stock || 0)}
                                    </div>
                                  </button>
                                ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                                No se encontraron productos
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="0"
                        className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-black text-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                        value={transferData.quantity || ''}
                        onChange={(e) => setTransferData({ ...transferData, quantity: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleTransferSubmit}
                    disabled={!transferData.productId || !transferData.localeId || !transferData.sourceLocaleId || transferData.quantity <= 0 || isSubmitting}
                    className="w-full py-5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center space-x-3"
                  >
                    <span>{isSubmitting ? 'Procesando...' : 'Ejecutar Movimiento'}</span>
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* Incomes view removed */}

          {view === 'history' && (
            <div className="space-y-8">
              <div className="bg-indigo-50/50 p-8 rounded-3xl border border-indigo-100 flex flex-col gap-8">
                {/* Header & Actions Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-indigo-900">Historial y Exportación</h3>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Gestión de movimientos</p>
                  </div>

                  <div className="flex gap-2 self-end md:self-auto">
                    <button
                      onClick={handleExportHistoryCSV}
                      className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                      <Download className="w-4 h-4" />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={handleExportHistoryPDF}
                      className="flex items-center space-x-2 bg-rose-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                    >
                      <Download className="w-4 h-4" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={handleClearHistory}
                      className="flex items-center space-x-2 bg-white text-slate-500 px-4 py-2 rounded-xl font-bold text-xs hover:bg-rose-100 hover:text-rose-600 transition-colors shadow-sm border border-slate-200"
                      title="Eliminar datos visualizados"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter Toolbar Row */}
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-wrap md:flex-nowrap gap-5 items-center">

                  {/* Filter Mode Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 order-1">
                    <button
                      onClick={() => setHistoryFilterMode('date')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${historyFilterMode === 'date' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Día
                    </button>
                    <button
                      onClick={() => setHistoryFilterMode('range')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${historyFilterMode === 'range' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Rango
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(end.getDate() - 30);

                      const formatDate = (d: Date) => {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      };

                      setHistoryFilterMode('range');
                      setHistoryFilterStart(formatDate(start));
                      setHistoryFilterEnd(formatDate(end));
                    }}
                    className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-[10px] uppercase hover:bg-indigo-100 transition-colors border border-indigo-100/50 order-2"
                  >
                    Ver Últimos 30 Días
                  </button>

                  <div className="h-8 w-px bg-slate-100 hidden md:block mx-1 order-2"></div>

                  {/* Search Input */}
                  <div className="relative order-3 md:order-2 w-full md:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>

                  {/* Date Inputs (Mobile: Order 3 [New Line], Desktop: Order 2) */}
                  <div className="w-full md:w-auto order-3 md:order-2 flex flex-wrap items-center gap-3">
                    {historyFilterMode === 'date' ? (
                      <div className="flex items-center gap-2 px-1 w-full md:w-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha:</span>
                        <input
                          type="date"
                          value={historySingleDate}
                          onChange={(e) => setHistorySingleDate(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none uppercase focus:border-indigo-400 transition-colors flex-1 md:flex-none"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 px-1 flex-1 md:flex-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Desde:</span>
                          <input
                            type="date"
                            value={historyFilterStart}
                            onChange={(e) => setHistoryFilterStart(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none uppercase focus:border-indigo-400 transition-colors w-full md:w-auto"
                          />
                        </div>
                        <div className="flex items-center gap-2 px-1 flex-1 md:flex-none">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta:</span>
                          <input
                            type="date"
                            value={historyFilterEnd}
                            onChange={(e) => setHistoryFilterEnd(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none uppercase focus:border-indigo-400 transition-colors w-full md:w-auto"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-8 w-px bg-slate-100 hidden md:block mx-1 order-4"></div>

                  {/* Locale Dropdown (Mobile: Order 2, Desktop: Order 3) */}
                  <div className="flex items-center gap-2 px-1 order-2 md:order-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Destino:</span>
                    <select
                      value={historyFilterLocale}
                      onChange={(e) => setHistoryFilterLocale(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none uppercase focus:border-indigo-400 transition-colors min-w-[100px]"
                    >
                      <option value="">TODOS</option>
                      <option value="deposit">DEPÓSITO CENTRAL</option>
                      {locales.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reset Button */}
                  {(historyFilterStart || historyFilterEnd || historyFilterLocale || historySearchTerm || (historyFilterMode === 'date' && historySingleDate !== new Date().toISOString().split('T')[0])) && (
                    <button
                      onClick={() => {
                        setHistoryFilterStart('');
                        setHistoryFilterEnd('');
                        setHistoryFilterLocale('');
                        setHistorySearchTerm('');
                        setHistorySingleDate(new Date().toISOString().split('T')[0]);
                        setHistoryFilterMode('date');
                      }}
                      className="ml-auto md:ml-0 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors order-2 md:order-5"
                      title="Restablecer filtros"
                    >
                      <div className="flex items-center gap-1">
                        <X className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase hidden md:inline">Limpiar</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const grouped: { date: string; items: Transfer[] }[] = [];
                filteredTransfers.forEach(t => {
                  // Extract date part (assuming format "DD/MM/YYYY, HH:MM:SS" or similar)
                  const datePart = t.date.split(',')[0].trim();
                  const lastGroup = grouped[grouped.length - 1];
                  if (lastGroup && lastGroup.date === datePart) {
                    lastGroup.items.push(t);
                  } else {
                    grouped.push({ date: datePart, items: [t] });
                  }
                });

                if (filteredTransfers.length === 0) {
                  return <div className="text-center py-20 text-slate-400">Sin movimientos en este rango de fechas</div>;
                }

                const today = new Date().toLocaleDateString();

                return grouped.map((group, groupIdx) => {
                  let dateLabel = group.date;
                  if (group.date === today) dateLabel = "Hoy";

                  return (
                    <div key={groupIdx} className="space-y-4">
                      <div className="flex items-center space-x-4 pl-2">
                        <div className="h-px bg-slate-200 flex-1" />
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                          {dateLabel}
                        </h3>
                        <div className="h-px bg-slate-200 flex-1" />
                      </div>

                      {/* Mobile Cards (Hidden on Desktop) */}
                      <div className="md:hidden space-y-4">
                        {group.items.map(t => (
                          <div key={t.id} className="bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex items-start md:items-center justify-between group hover:border-indigo-200 transition-colors relative overflow-hidden">
                            <div className="flex items-start md:items-center gap-3 md:gap-4 relative z-10 w-full min-w-0 pr-2">
                              <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 text-white rounded-lg md:rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 mt-1 md:mt-0">
                                <History className="w-4 h-4 md:w-5 md:h-5" />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="overflow-x-auto pb-1 -mb-1">
                                    <h4 className="text-xs md:text-sm font-black text-slate-800 whitespace-nowrap leading-tight">{t.productName}</h4>
                                  </div>
                                  <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 md:hidden">
                                    {t.date.split(',')[1]?.trim().slice(0, 5) || ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 max-w-full">
                                    <span className="text-slate-400">De:</span>
                                    <span className="uppercase truncate">{t.sourceLocaleName || 'Depósito'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 max-w-full">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="uppercase truncate">{t.destinationLocaleName}</span>
                                  </div>
                                  <span className="hidden md:inline-block text-[10px] font-bold text-slate-400">
                                    {t.date.split(',')[1]?.trim() || t.date}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0 pl-1 relative z-10 self-center md:self-auto">
                              <span className="text-base md:text-xl font-black text-indigo-600 tracking-tight whitespace-nowrap">
                                -{t.quantity} <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase">u.</span>
                              </span>

                              {/* Desktop Actions */}
                              <div className="hidden md:flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRepeatTransfer(t); }}
                                  className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-500 hover:bg-indigo-50"
                                  title="Repetir Transferencia"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEditTransfer(t)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-500 hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteTransfer(t.id)} className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                              </div>

                              {/* Mobile Repeat & Delete Actions */}
                              <div className="md:hidden mt-2 grid grid-cols-2 gap-2 relative z-20">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRepeatTransfer(t); }}
                                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-sm border border-indigo-100"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase">Repetir</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTransfer(t.id); }}
                                  className="p-2 bg-rose-50 text-rose-600 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-sm border border-rose-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase">Eliminar</span>
                                </button>
                              </div>

                              {/* Mobile Actions (Tap to edit/delete) */}
                              <div className="md:hidden absolute inset-0 z-0" onClick={() => openEditTransfer(t)} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table (Hidden on Mobile) */}
                      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origen</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cantidad</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.items.map(t => (
                              <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                  {t.date.split(',')[1]?.trim() || ''}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-sm font-bold text-slate-900">{t.productName}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wide border border-slate-200">
                                    {t.sourceLocaleName || 'Depósito Central'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide border border-slate-200">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {t.destinationLocaleName}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black shadow-sm border border-indigo-100">
                                    -{t.quantity} un.
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleRepeatTransfer(t)}
                                      className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                                      title="Repetir"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => openEditTransfer(t)}
                                      className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransfer(t.id)}
                                      className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                });
              })()}

              {storageMode === 'cloud' && transfers.length >= historyLimit && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setHistoryLimit(prev => prev + 30)}
                    className="px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Cargar más movimientos
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'locales' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-center bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 gap-4">
                <div>
                  <h3 className="font-bold text-emerald-900">Gestión de Destinos</h3>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Administrar sucursales y puntos de entrega</p>
                </div>
                <button
                  onClick={() => setIsNewLocaleModalOpen(true)}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Destino</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locales.map(l => (
                  <div key={l.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{l.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: {l.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleRenameLocale(l.id, l.name)}
                        className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100"
                        title="Renombrar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocale(l.id)}
                        className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-rose-600 hover:bg-rose-50 border border-slate-100"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {locales.length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-400">
                    No hay destinos creados.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-2 py-2 md:hidden z-40 flex justify-between items-center pb-safe h-[calc(3.5rem+env(safe-area-inset-bottom))] shadow-lg shadow-slate-200/50">
        <BottomNavItem
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Inicio"
          active={view === 'analytics'}
          onClick={() => { setView('analytics'); setIsMobileMenuOpen(false); window.scrollTo(0, 0); }}
        />
        <BottomNavItem
          icon={<Warehouse className="w-5 h-5" />}
          label="Stock"
          active={view === 'master'}
          onClick={() => { setView('master'); setIsMobileMenuOpen(false); window.scrollTo(0, 0); }}
        />
        <BottomNavItem
          icon={<ArrowRightLeft className="w-5 h-5" />}
          label="Mover"
          active={view === 'transfers'}
          onClick={() => { setView('transfers'); setIsMobileMenuOpen(false); window.scrollTo(0, 0); }}
        />
        <BottomNavItem
          icon={<History className="w-5 h-5" />}
          label="Logs"
          active={view === 'history'}
          onClick={() => { setView('history'); setIsMobileMenuOpen(false); window.scrollTo(0, 0); }}
        />
        <BottomNavItem
          icon={<Menu className="w-5 h-5" />}
          label="Menú"
          active={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(true)}
        />
      </div>



      {/* Mobile Drawer (Sucursales Selection) */}
      {
        isMobileMenuOpen && (
          <div className="fixed inset-0 z-[60] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] p-6 md:p-8 animate-in slide-in-from-bottom-full duration-500">
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center">
                  <Settings className="w-6 h-6 mr-2 text-indigo-500" /> Menú
                </h3>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => { setView('locales'); setIsMobileMenuOpen(false); }}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${view === 'locales' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-100'}`}
                >
                  <MapPin className="w-6 h-6" />
                  <span className="font-bold text-xs uppercase tracking-wider">Destinos</span>
                </button>
                <button
                  onClick={() => { setView('management'); setIsMobileMenuOpen(false); }}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${view === 'management' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-100'}`}
                >
                  <Settings className="w-6 h-6" />
                  <span className="font-bold text-xs uppercase tracking-wider">Gestión</span>
                </button>
              </div>


              <div className="mt-8 pt-8 border-t border-slate-100">
                <button
                  onClick={() => { setIsSettingsModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full p-4 rounded-2xl bg-slate-50 text-slate-700 font-bold text-sm flex items-center justify-center gap-3 border border-slate-100 hover:bg-slate-100 transition-colors"
                >
                  <Settings className="w-5 h-5 text-indigo-500" />
                  Ajustes y Datos
                </button>
              </div>

              {/* User Profile Section */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {user?.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user?.displayName || 'Usuario'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full mt-6 py-4 font-bold text-slate-400 bg-slate-100 rounded-[1.5rem]"
              >
                Cerrar
              </button>
            </div>
          </div>
        )
      }

      {/* New Locale Modal */}
      {
        isNewLocaleModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">Nuevo Destino</h3>
                <button onClick={() => setIsNewLocaleModalOpen(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nombre del Destino</label>
                  <input
                    type="text"
                    value={newLocaleName}
                    onChange={(e) => setNewLocaleName(e.target.value)}
                    placeholder="Ej: Depósito B"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleAddLocale}
                  disabled={!newLocaleName.trim()}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Crear Destino
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Manage Locales Modal */}
      {
        isManageLocalesModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-black text-slate-900">Administrar Destinos</h3>
                <button onClick={() => setIsManageLocalesModalOpen(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                {locales.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">No hay destinos creados.</p>
                ) : (
                  locales.map(l => (
                    <div key={l.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Store className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700">{l.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRenameLocale(l.id, l.name)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                          title="Cambiar nombre"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocale(l.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => { setIsManageLocalesModalOpen(false); setIsNewLocaleModalOpen(true); }}
                  className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors"
                >
                  + Agregar Nuevo
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modern Transfer Modal */}
      {
        isTransferModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_32px_120px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col max-h-[90dvh] md:max-h-[85vh]">
              <div className="p-6 md:p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Distribución</h3>
                  <p className="text-xs md:text-sm font-semibold text-slate-500">Ajuste de stock en red.</p>
                </div>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-2xl transition-all shadow-sm active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 md:p-10 space-y-5 md:space-y-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar Categoría</label>
                    <select
                      className="w-full p-3 md:p-4 border border-slate-200 rounded-2xl md:rounded-[1.25rem] bg-indigo-50/30 text-sm md:text-base text-indigo-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      value={transferCategoryFilter}
                      onChange={(e) => setTransferCategoryFilter(e.target.value)}
                    >
                      <option value="all">Todas las categorías</option>
                      {categories.filter(c => c !== 'all').map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Artículo</label>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        Escanear
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Buscar o escribir producto..."
                      className="w-full p-4 md:p-5 border border-slate-200 rounded-2xl md:rounded-[1.25rem] bg-slate-50/50 text-sm md:text-base text-slate-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      value={transferSearchTerm}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTransferSearchTerm(val);
                        setShowTransferSuggestions(true);
                        if (val === '') {
                          setTransferData(prev => ({ ...prev, productId: '' }));
                        }
                      }}
                      onFocus={() => setShowTransferSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowTransferSuggestions(false), 200)}
                    />

                    {/* Autocomplete Suggestions */}
                    {showTransferSuggestions && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar left-0">
                        {getFilteredTransferProducts(products, transferSearchTerm, transferCategoryFilter).length > 0 ? (
                          getFilteredTransferProducts(products, transferSearchTerm, transferCategoryFilter)
                            .map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setTransferData(prev => ({ ...prev, productId: p.id }));
                                  setTransferSearchTerm(p.name);
                                  setShowTransferSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-b-0 flex justify-between items-center group"
                              >
                                <div>
                                  <div className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">{p.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">{p.sku}</div>
                                </div>
                                <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-600">
                                  Stock: {transferData.sourceLocaleId === 'deposit'
                                    ? p.masterStock
                                    : (locales.find(l => l.id === transferData.sourceLocaleId)?.inventory?.find(i => i.productId === p.id)?.stock || 0)}
                                </div>
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                            No se encontraron productos
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</label>
                  <select
                    className="w-full p-4 md:p-5 border border-slate-200 rounded-2xl md:rounded-[1.25rem] bg-slate-50/50 text-sm md:text-base text-slate-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={transferData.localeId}
                    onChange={(e) => setTransferData({ ...transferData, localeId: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {locales.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="00"
                    className="w-full p-4 md:p-5 border border-slate-200 rounded-2xl md:rounded-[1.25rem] bg-slate-50/50 text-slate-900 font-black text-xl md:text-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    value={transferData.quantity || ''}
                    onChange={(e) => setTransferData({ ...transferData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="p-6 md:p-10 pt-0">
                <button
                  onClick={handleTransferSubmit}
                  disabled={!transferData.productId || !transferData.localeId || transferData.quantity <= 0 || isSubmitting}
                  className="w-full py-5 px-6 bg-indigo-600 text-white rounded-2xl md:rounded-[1.25rem] font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <span>{isSubmitting ? 'Procesando...' : (editingTransferId ? 'Ajustar' : 'Distribuir')}</span>
                  {!isSubmitting && <ArrowRightLeft className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Product Modal */}
      {
        isProductModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-[0_32px_120px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col max-h-[90dvh] md:max-h-[85vh]">
              <div className="p-6 md:p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                  </h3>
                  <p className="text-xs md:text-sm font-semibold text-slate-500">Gestión de catálogo maestro.</p>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-2xl transition-all shadow-sm active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 md:p-10 space-y-5 md:space-y-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</label>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <Camera className="w-3 h-3" />
                        Escanear
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="XYZ-000"
                      className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      value={productData.sku}
                      onChange={(e) => setProductData({ ...productData, sku: e.target.value.toUpperCase() })}
                    />
                  </div>

                  {/* Additional SKUs Section */}
                  <div className="col-span-2 space-y-2 border-t border-slate-100 pt-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Códigos Adicionales</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Escanear o escribir código extra"
                        className="flex-1 p-3 border border-slate-200 rounded-xl bg-slate-50/50 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                        id="additional-sku-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.currentTarget;
                            const val = input.value.trim().toUpperCase();
                            if (val && !productData.additionalSkus?.includes(val) && val !== productData.sku) {
                              setProductData(prev => ({ ...prev, additionalSkus: [...(prev.additionalSkus || []), val] }));
                              input.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById('additional-sku-input') as HTMLInputElement;
                          const val = input.value.trim().toUpperCase();
                          if (val && !productData.additionalSkus?.includes(val) && val !== productData.sku) {
                            setProductData(prev => ({ ...prev, additionalSkus: [...(prev.additionalSkus || []), val] }));
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200"
                      >
                        Agregar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSecondaryScannerOpen(true)}
                        className="px-3 py-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-200 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {productData.additionalSkus?.map(ask => (
                        <span key={ask} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                          {ask}
                          <button
                            onClick={() => setProductData(prev => ({ ...prev, additionalSkus: prev.additionalSkus?.filter(s => s !== ask) }))}
                            className="p-0.5 hover:bg-indigo-200 rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Inicial</label>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      value={productData.masterStock || ''}
                      onChange={(e) => setProductData({ ...productData, masterStock: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Vencimiento (Opcional)</label>
                  <input
                    type="date"
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={productData.expirationDate}
                    onChange={(e) => setProductData({ ...productData, expirationDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                  <input
                    ref={productNameInputRef}
                    type="text"
                    placeholder="Nombre del producto"
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={productData.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProductData({ ...productData, name: value });

                      // Filter suggestions
                      if (value.trim().length > 0) {
                        const filtered = PRODUCT_NAMES.filter(name =>
                          name.toLowerCase().includes(value.toLowerCase())
                        ).slice(0, 8); // Limit to 8 suggestions
                        setProductNameSuggestions(filtered);
                        setShowSuggestions(true);
                      } else {
                        setShowSuggestions(false);
                      }
                    }}
                    onFocus={() => {
                      if (productData.name.trim().length > 0 && productNameSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                  />

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && productNameSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar">
                      {productNameSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setProductData({ ...productData, name: suggestion });
                            setShowSuggestions(false);
                            productNameInputRef.current?.focus();
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors text-sm font-semibold text-slate-700 hover:text-indigo-600 border-b border-slate-100 last:border-b-0"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                    <button
                      type="button"
                      onClick={() => setIsNewCategoryModalOpen(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Nueva
                    </button>
                  </div>
                  <select
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={productData.category}
                    onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                  >
                    <option value="">Seleccionar categoría...</option>
                    {categories.filter(c => c !== 'all').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 md:p-10 pt-0">
                <button
                  onClick={handleProductSubmit}
                  disabled={!productData.sku || !productData.name || !productData.category}
                  className="w-full py-5 px-6 bg-indigo-600 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-indigo-700 disabled:opacity-20 shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <span>{editingProduct ? 'Actualizar' : 'Crear Producto'}</span>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      { /* Income Modal removed */}

      {/* New Category Modal */}
      {isNewCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsNewCategoryModalOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col max-h-[90dvh]">
            <div className="p-6 md:p-10 flex-shrink-0">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black text-slate-900">Nueva Categoría</h3>
                <button
                  onClick={() => setIsNewCategoryModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full transition-all hover:bg-slate-200 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto custom-scrollbar p-6 md:p-10 pt-0">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Categoría</label>
                  <input
                    type="text"
                    placeholder="PANADERÍA, CARNES, etc."
                    className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all uppercase"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    autoFocus
                  />
                  <p className="text-xs text-slate-400">Las categorías se guardan en mayúsculas automáticamente</p>
                </div>

                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="w-full py-4 px-6 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Crear Categoría</span>
                </button>

                {customCategories.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Categorías Personalizadas</p>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {customCategories.map(cat => (
                        <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group/item hover:bg-white border border-transparent hover:border-slate-100 transition-all">
                          <span className="text-xs font-bold text-slate-700">{cat}</span>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsSettingsModalOpen(false)} />
          <div className="relative bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl rounded-t-[2rem] px-8 py-6 border-b border-slate-100 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Ajustes</h2>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Storage Mode Section */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Modo de Almacenamiento</h4>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${storageMode === 'cloud' ? 'bg-violet-100 text-violet-600' : 'bg-slate-200 text-slate-600'}`}>
                      {storageMode === 'cloud' ? <Cloud className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{storageMode === 'cloud' ? 'Nube (Online)' : 'Memoria Local'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {storageMode === 'cloud' ? 'Sincronización en tiempo real' : 'Solo en este dispositivo'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('¿Cambiar modo de almacenamiento? La página se recargará.')) {
                        localStorage.removeItem('storage_preference');
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                  >
                    Cambiar
                  </button>
                </div>
              </div>

              {/* Export Section */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Exportar Datos</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { handleExportData(); setIsSettingsModalOpen(false); }}
                    className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 font-bold text-sm flex flex-col items-center justify-center gap-2 hover:bg-indigo-100 transition-colors border border-indigo-100/50"
                  >
                    <Download className="w-5 h-5" />
                    Exportar JSON
                  </button>
                  <button
                    onClick={() => { handleExportProductsCSV(); setIsSettingsModalOpen(false); }}
                    className="p-4 rounded-2xl bg-teal-50 text-teal-600 font-bold text-sm flex flex-col items-center justify-center gap-2 hover:bg-teal-100 transition-colors border border-teal-100/50"
                  >
                    <FileText className="w-5 h-5" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* Import Section */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Importar Datos</h4>
                <div className="space-y-3">
                  <label className="w-full p-4 rounded-2xl bg-indigo-50 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-indigo-100 transition-colors border border-indigo-100/50">
                    <Upload className="w-5 h-5" />
                    <span>Importar JSON</span>
                    <input type="file" accept=".json" onChange={(e) => { handleImportData(e); setIsSettingsModalOpen(false); }} className="hidden" />
                  </label>
                  <label className="w-full p-4 rounded-2xl bg-emerald-50 text-emerald-600 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-100 transition-colors border border-emerald-100/50">
                    <Upload className="w-5 h-5" />
                    <span>Importar Productos CSV</span>
                    <input type="file" accept=".csv" onChange={(e) => { handleImportProductsCSV(e); setIsSettingsModalOpen(false); }} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Install App */}
              {deferredPrompt && (
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Aplicación</h4>
                  <button
                    onClick={() => { handleInstallClick(); setIsSettingsModalOpen(false); }}
                    className="w-full p-4 rounded-2xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    <Laptop className="w-5 h-5" />
                    Instalar Aplicación
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {isScannerOpen && (
        <BarcodeScanner
          onScanSuccess={handleBarcodeScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
      {isSecondaryScannerOpen && (
        <BarcodeScanner
          onScanSuccess={(decodedText) => {
            const val = decodedText.trim().toUpperCase();
            if (val && !productData.additionalSkus?.includes(val) && val !== productData.sku) {
              setProductData(prev => ({ ...prev, additionalSkus: [...(prev.additionalSkus || []), val] }));
            }
            setIsSecondaryScannerOpen(false);
          }}
          onClose={() => setIsSecondaryScannerOpen(false)}
        />
      )}
    </div >
  );
}
