
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch, Timestamp } from "firebase/firestore";

const firebaseConfig = {
    projectId: "deposito-inventory-f7a1b",
    appId: "1:221074983931:web:febc0346ec1d7dc9bed95e",
    storageBucket: "deposito-inventory-f7a1b.firebasestorage.app",
    apiKey: "AIzaSyCKXfqtER1968lTf-t4-PWxDWGmb--dXEA",
    authDomain: "deposito-inventory-f7a1b.firebaseapp.com",
    messagingSenderId: "221074983931",
    projectNumber: "221074983931"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function repairTransfers() {
    console.log("Iniciando reparación de transferencias...");
    const transfersRef = collection(db, 'transfers');
    const snapshot = await getDocs(transfersRef);

    let batch = writeBatch(db);
    let count = 0;
    let totalUpdated = 0;

    for (const document of snapshot.docs) {
        const data = document.data();
        if (!data.timestamp && data.date) {
            try {
                // Formato esperado: "DD/MM/YYYY, HH:MM:SS" o "DD/MM/YYYY"
                const parts = data.date.split(',');
                const datePart = parts[0].trim();
                const [d, m, y] = datePart.split('/').map(Number);

                let dateObj;
                if (parts[1]) {
                    const timePart = parts[1].trim();
                    const [hh, mm, ss] = timePart.split(':').map(Number);
                    dateObj = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
                } else {
                    dateObj = new Date(y, m - 1, d, 12, 0, 0); // Default a mediodía si no hay hora
                }

                if (!isNaN(dateObj.getTime())) {
                    batch.update(doc(db, 'transfers', document.id), {
                        timestamp: Timestamp.fromDate(dateObj)
                    });
                    count++;
                    totalUpdated++;

                    // Firestore batch limit is 500
                    if (count >= 400) {
                        await batch.commit();
                        console.log(`Commit de lote: ${totalUpdated} registros actualizados hasta ahora...`);
                        batch = writeBatch(db);
                        count = 0;
                    }
                }
            } catch (e) {
                console.error(`Error procesando documento ${document.id}:`, e);
            }
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`Reparación finalizada. Total actualizados: ${totalUpdated}`);
    process.exit(0);
}

repairTransfers().catch(err => {
    console.error("Error fatal:", err);
    process.exit(1);
});
