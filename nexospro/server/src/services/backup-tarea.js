// Instalaciones locales en Windows (PC de cliente): garantiza que exista la
// tarea diaria del Programador de tareas que genera la copia en
// C:\backup\filanex aunque la aplicación esté cerrada. Se comprueba en cada
// arranque del servidor; si falta, se crea sola. En la nube (Linux) no hace
// nada. Si no se puede crear (permisos), avisa por consola indicando el
// instalador manual scripts\instalar-tarea-backup.cmd.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAREA = "FilanexCopiaDiaria";
const RAIZ_SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function ejecutar(comando, args) {
  return new Promise((resolve) => {
    execFile(comando, args, { windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, salida: `${stdout ?? ""}${stderr ?? ""}` });
    });
  });
}

function escaparXml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Definición de la tarea: diaria a las 08:30, se recupera si el PC estaba
// apagado (StartWhenAvailable), sin exigir administrador (InteractiveToken).
export function xmlTarea() {
  const node = escaparXml(process.execPath);
  const dir = escaparXml(RAIZ_SERVER);
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Copia diaria de FILANEX en C:\\backup\\filanex (visible en Ajustes -&gt; Copias)</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T08:30:00</StartBoundary>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT30M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${node}</Command>
      <Arguments>scripts\\backup-local.mjs</Arguments>
      <WorkingDirectory>${dir}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
}

export async function asegurarTareaCopiaWindows() {
  if (process.platform !== "win32" || process.env.BACKUP_DESACTIVADO === "true") return;
  try {
    const consulta = await ejecutar("schtasks", ["/query", "/tn", TAREA]);
    if (consulta.ok) return; // ya está instalada
    const xmlPath = path.join(os.tmpdir(), `filanex-tarea-${process.pid}.xml`);
    try {
      // schtasks exige el XML en UTF-16 con marca BOM.
      fs.writeFileSync(xmlPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xmlTarea(), "utf16le")]));
      const alta = await ejecutar("schtasks", ["/create", "/tn", TAREA, "/xml", xmlPath, "/f"]);
      if (alta.ok) {
        console.log(
          `[backup] Tarea de Windows "${TAREA}" instalada automáticamente (diaria 08:30, se recupera si el PC estaba apagado)`
        );
      } else {
        console.warn(
          `[backup] No se pudo instalar la tarea "${TAREA}". Ejecuta una vez scripts\\instalar-tarea-backup.cmd. Detalle: ${alta.salida.trim()}`
        );
      }
    } finally {
      fs.rmSync(xmlPath, { force: true });
    }
  } catch (e) {
    console.warn(`[backup] No se pudo comprobar la tarea "${TAREA}":`, e.message);
  }
}
