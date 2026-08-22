// Verificación contra los 3 vectores oficiales del documento AEAT
// "Veri-Factu_especificaciones_huella_hash_registros.pdf" (v0.1.2, apartado 6).
import { huellaAlta, huellaAnulacion } from "../src/services/verifactu.js";

const casos = [
  {
    nombre: "Caso 1: primer registro (alta, sin anterior)",
    fn: () =>
      huellaAlta({
        nifEmisor: "89890001K",
        numSerie: "12345678/G33",
        fechaExpedicion: "01-01-2024",
        tipoFactura: "F1",
        cuotaTotal: 12.35,
        importeTotal: 123.45,
        huellaAnterior: "",
        fechaHoraGen: "2024-01-01T19:20:30+01:00",
      }),
    esperada: "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60",
  },
  {
    nombre: "Caso 2: registro de alta encadenado",
    fn: () =>
      huellaAlta({
        nifEmisor: "89890001K",
        numSerie: "12345679/G34",
        fechaExpedicion: "01-01-2024",
        tipoFactura: "F1",
        cuotaTotal: 12.35,
        importeTotal: 123.45,
        huellaAnterior: "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60",
        fechaHoraGen: "2024-01-01T19:20:35+01:00",
      }),
    esperada: "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97",
  },
  {
    nombre: "Caso 3: registro de anulación encadenado",
    fn: () =>
      huellaAnulacion({
        nifEmisor: "89890001K",
        numSerie: "12345679/G34",
        fechaExpedicion: "01-01-2024",
        huellaAnterior: "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97",
        fechaHoraGen: "2024-01-01T19:20:40+01:00",
      }),
    esperada: "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68",
  },
];

let fallos = 0;
for (const c of casos) {
  const obtenida = c.fn();
  const ok = obtenida === c.esperada;
  console.log(`${ok ? "OK   " : "FALLO"} ${c.nombre}`);
  if (!ok) {
    console.log(`       esperada: ${c.esperada}`);
    console.log(`       obtenida: ${obtenida}`);
    fallos++;
  }
}
process.exit(fallos ? 1 : 0);
