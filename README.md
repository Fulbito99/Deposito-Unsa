<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sistema de Gestión de Inventario - Depósito

Sistema completo de gestión de inventario multi-ubicación con soporte para transferencias bidireccionales, escaneo de códigos de barras y sincronización en la nube.

🔗 **URL de Producción:** https://deposito-inventory-f7a1b.web.app/

## Características Principales

### 📦 Gestión de Inventario
- **Stock Maestro**: Control centralizado del inventario en depósito central
- **Múltiples Locales**: Gestión de stock en diferentes puntos de venta
- **Categorías Personalizadas**: Organización flexible de productos
- **Códigos Múltiples**: Soporte para SKUs adicionales por producto
- **Alertas de Vencimiento**: Notificaciones automáticas de productos próximos a vencer

### 🔄 Sistema de Movimientos
- **Transferencias Bidireccionales**:
  - Depósito → Local (distribución)
  - Local → Local (redistribución)
  - Local → Depósito (devoluciones)
- **Interfaz Visual**: Columnas de origen y destino con stock en tiempo real
- **Validación Automática**: Prevención de transferencias inválidas
- **Historial Completo**: Trazabilidad de todos los movimientos

### 📱 Características Móviles
- **Diseño Responsivo**: Optimizado para dispositivos móviles
- **Escáner de Códigos**: Integración con cámara para escaneo de SKUs
- **Navegación Intuitiva**: Menú inferior de fácil acceso
- **Modales Optimizados**: Interfaces adaptadas a pantallas pequeñas

### 📊 Analíticas y Reportes
- **Dashboard Visual**: Gráficos de distribución y comparación
- **Exportación**: Descarga de historial en CSV y PDF
- **Filtros Avanzados**: Por fecha, rango y destino
- **Top Productos**: Ranking de productos más transferidos

### ☁️ Sincronización
- **Modo Cloud**: Sincronización en tiempo real con Firebase
- **Modo Local**: Almacenamiento offline en navegador
- **Autenticación**: Sistema de login seguro
- **Multi-dispositivo**: Acceso desde cualquier dispositivo

## Ejecutar Localmente

**Requisitos:** Node.js 16+

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Firebase** (opcional, para modo cloud):
   - Crear proyecto en [Firebase Console](https://console.firebase.google.com)
   - Actualizar credenciales en `firebase.ts`

3. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

4. **Compilar para producción:**
   ```bash
   npm run build
   ```

## Despliegue

**Firebase Hosting:**
```bash
firebase deploy --only hosting --project deposito-inventory-f7a1b
```

## Tecnologías

- **Frontend**: React + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Backend**: Firebase (Firestore + Authentication)
- **Gráficos**: Recharts
- **Escáner**: html5-qrcode
- **Exportación**: jsPDF

## Estructura del Proyecto

```
deposito/
├── App.tsx              # Componente principal
├── BarcodeScanner.tsx   # Componente de escáner
├── types.ts             # Definiciones de tipos
├── firebase.ts          # Configuración de Firebase
└── constants.tsx        # Datos iniciales
```

---

**Última actualización:** Enero 2026 - v2.0
- ✅ Sección de Movimientos implementada
- ✅ Transferencias bidireccionales
- ✅ Mejoras de UI móvil
- ✅ Soporte para devoluciones al depósito
