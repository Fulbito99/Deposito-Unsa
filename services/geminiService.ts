
import { GoogleGenAI } from "@google/genai";
import { Product, Locale, Transfer } from "../types";

export const getInventoryAnalysis = async (
  products: Product[],
  locales: Locale[],
  transfers: Transfer[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analiza el siguiente estado de inventario logístico para un negocio con un depósito maestro y 3 sucursales.
    Proporciona un resumen de la disponibilidad, identifica productos con stock crítico (bajo stock en depósito) y sugiere cómo optimizar la distribución a las sucursales basándote en los niveles actuales.
    
    Depósito Maestro: ${JSON.stringify(products.map(p => ({ name: p.name, stock: p.masterStock })))}
    Sucursales: ${JSON.stringify(locales.map(l => ({ name: l.name, stock: l.inventory })))}
    Últimas Transferencias: ${JSON.stringify(transfers.slice(-5))}
    
    Responde en español de forma profesional, enfocándote puramente en gestión de existencias y logística.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No se pudo generar el análisis en este momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error al conectar con la IA para el análisis.";
  }
};
