import { Schema } from "mongoose";
import { modeloTenant } from "./tenant.js";
import { normalizarMatricula } from "../services/validacion.js";

// Préstamo de un vehículo de cortesía a un cliente (normalmente mientras su
// coche está en el taller). "Vencido" es derivado: activo con fechaPrevista pasada.
const prestamoCortesiaSchema = new Schema(
  {
    vehiculo: { type: Schema.Types.ObjectId, ref: "Vehiculo", required: true },
    matricula: { type: String, required: true, uppercase: true, trim: true, set: normalizarMatricula },
    clienteNombre: { type: String, required: true },
    clienteNIF: String,
    clienteDireccion: String,
    clienteFechaNacimiento: Date,
    clienteLugarNacimiento: String,
    telefono: String,
    telefonoTrabajo: String,
    permisoConducirNumero: String,
    permisoConducirExpedicion: Date,
    permisoConducirLugar: String,
    otroConductor: String,
    orden: { type: Schema.Types.ObjectId, ref: "OrdenTrabajo" },
    numeroOrden: String,
    cita: { type: Schema.Types.ObjectId, ref: "Cita" }, // cita que originó el préstamo
    vehiculoReparacionMatricula: { type: String, uppercase: true, trim: true, set: normalizarMatricula },
    vehiculoReparacionMarcaModelo: String,
    vehiculoReparacionVIN: String,
    fechaSalida: { type: Date, default: Date.now },
    fechaPrevista: { type: Date, required: true }, // devolución acordada
    fechaDevolucion: Date, // real
    kmSalida: Number,
    kmEntrada: Number,
    combustibleSalida: { type: Number, min: 0, max: 8 }, // octavos de depósito (1-8)
    vinCortesia: String,
    aseguradora: String,
    numeroContratoSeguro: String,
    franquiciaTerceros: Number,
    franquiciaVehiculo: Number,
    franquiciaRobo: Number,
    rescateFranquicia: { type: Boolean, default: false },
    transferenciaSeguro: { type: Boolean, default: false },
    rescatePorDia: Number,
    participacionForfaitDiaria: Number,
    kmMaximoDia: Number,
    kmMaximoTotal: Number,
    importeExcesoKm: Number, // €/km
    estado: { type: String, enum: ["activo", "devuelto"], default: "activo" },
    notas: String,
  },
  { timestamps: true }
);

prestamoCortesiaSchema.index({ estado: 1, fechaPrevista: 1 });

export default modeloTenant("PrestamoCortesia", prestamoCortesiaSchema);
