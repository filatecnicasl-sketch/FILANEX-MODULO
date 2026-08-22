import { Schema, model } from "mongoose";

const vehiculoSchema = new Schema(
  {
    matricula: { type: String, required: true, uppercase: true, trim: true },
    marca: String,
    modelo: String,
    bastidor: String, // VIN
    color: String,
    combustible: String,
    anio: Number,
    km: Number,
    tipo: { type: String, enum: ["cliente", "cortesia"], default: "cliente" },
    cliente: { type: Schema.Types.ObjectId, ref: "Cliente" },
    clienteNombre: String, // desnormalizado para listados rápidos
    notas: String,
  },
  { timestamps: true }
);

vehiculoSchema.index({ matricula: 1 }, { unique: true });

export default model("Vehiculo", vehiculoSchema);
