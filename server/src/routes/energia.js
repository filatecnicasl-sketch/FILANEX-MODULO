import { Router } from "express";
import { requiereModulo } from "../config/modulos.js";
import comercializadoras from "./energia-comercializadoras.js";
import canales from "./energia-canales.js";
import campanas from "./energia-campanas.js";
import suministros from "./energia-suministros.js";
import tramites from "./energia-tramites.js";
import comisiones from "./energia-comisiones.js";
import estudios from "./energia-estudios.js";
import consumos from "./energia-consumos.js";
import autofacturas from "./energia-autofacturas.js";
import alertas from "./energia-alertas.js";

// Módulo Energía: gestión de canal directo de comercializadoras. Todo lo que
// cuelga de aquí exige el módulo activado en la empresa.
const router = Router();

router.use(requiereModulo("energia"));
router.use("/comercializadoras", comercializadoras);
router.use("/canales", canales);
router.use("/campanas", campanas);
router.use("/suministros", suministros);
router.use("/tramites", tramites);
router.use("/comisiones", comisiones);
router.use("/estudios", estudios);
router.use("/consumos", consumos);
router.use("/autofacturas", autofacturas);
router.use("/alertas", alertas);

export default router;
