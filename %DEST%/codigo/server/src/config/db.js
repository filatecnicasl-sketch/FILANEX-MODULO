import mongoose from "mongoose";

// Falla rápido si no hay conexión, en lugar de encolar operaciones.
mongoose.set("bufferCommands", false);

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI no definida: la API arranca sin base de datos.");
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log("MongoDB conectado.");
  } catch (err) {
    console.error("No se pudo conectar a MongoDB:", err.message);
  }
}
