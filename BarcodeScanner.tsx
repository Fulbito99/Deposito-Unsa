import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string>('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const qrCodeRegionId = 'qr-reader';

    useEffect(() => {
        startScanner();
        return () => {
            stopScanner();
        };
    }, []);

    const startScanner = async () => {
        try {
            setError('');
            setIsScanning(true);

            const html5QrCode = new Html5Qrcode(qrCodeRegionId);
            scannerRef.current = html5QrCode;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            };

            await html5QrCode.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    // Success callback
                    onScanSuccess(decodedText);
                    stopScanner();
                },
                (errorMessage) => {
                    // Error callback (scanning errors, not critical)
                    // We can ignore these as they happen frequently during scanning
                }
            );
        } catch (err) {
            console.error('Error starting scanner:', err);
            setError('No se pudo acceder a la cámara. Verifica los permisos.');
            setIsScanning(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    const handleClose = () => {
        stopScanner();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
            {/* Header */}
            <div className="w-full max-w-md mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Camera className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-black text-white">Escanear Código</h3>
                </div>
                <button
                    onClick={handleClose}
                    className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md text-white rounded-full transition-all active:scale-90 hover:bg-white/20"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Scanner Container */}
            <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
                <div id={qrCodeRegionId} className="w-full" />
            </div>

            {/* Instructions */}
            <div className="mt-6 text-center max-w-md">
                {isScanning ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <p className="text-sm font-bold text-white">Apunta la cámara al código de barras</p>
                        </div>
                        <p className="text-xs text-slate-300">
                            Soporta EAN-13, Code-128, QR y más formatos
                        </p>
                    </div>
                ) : error ? (
                    <div className="bg-rose-500/20 border border-rose-500/50 rounded-2xl p-4">
                        <p className="text-sm font-bold text-rose-200">{error}</p>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <p className="text-sm font-bold text-white">Iniciando cámara...</p>
                    </div>
                )}
            </div>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className="mt-8 px-8 py-3 bg-white/10 backdrop-blur-md text-white rounded-2xl font-bold text-sm hover:bg-white/20 transition-all active:scale-95"
            >
                Cancelar
            </button>
        </div>
    );
}
