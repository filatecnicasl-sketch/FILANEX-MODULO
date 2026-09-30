import { Router } from "express";
import { requiereModulo } from "../config/modulos.js";
import comercializadoras from "./energia-comercializadoras.js";
import suministros from "./energia-suministros.js";

// Módulo Energía: gestión de canal directo de comercializadoras. Todo lo que
// cuelga de aquí exige el módulo activado en la empresa.
const router = Router();

router.use(requiereModulo("energia"));
router.use("/comercializadoras", comercializadoras);
router.use("/suministros", suministros);

export default router;
