import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const respuesta = await ai.models.list();
const nombres = (respuesta.models ?? respuesta.page ?? []).map((m) => m.name);
console.log(nombres.join("\n"));
