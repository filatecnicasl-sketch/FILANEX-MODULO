param(
    [ValidateSet('Recortes', 'ImprPant')][string]$Metodo,
    [string]$TituloVentana
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::Error.WriteLine('Formulario de Windows cargado')
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CapturaWindows {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string clase, string titulo);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr ventana);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr ventana, int modo);
    [DllImport("user32.dll")] public static extern void keybd_event(byte tecla, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint x, uint y, uint datos, UIntPtr extra);
    [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
}
'@
[Console]::Error.WriteLine('API nativa de Windows cargada')
$proceso = Get-Process | Where-Object { $_.MainWindowTitle.StartsWith($TituloVentana) } | Select-Object -First 1
$ventana = if ($null -ne $proceso) { $proceso.MainWindowHandle } else { [IntPtr]::Zero }
if ($ventana -eq [IntPtr]::Zero) { throw 'No se encuentra la ventana de pruebas; no se realiza ninguna captura.' }
[void][CapturaWindows]::ShowWindow($ventana, 3)
[void][CapturaWindows]::SetForegroundWindow($ventana)
Start-Sleep -Milliseconds 600
$secuencia = [CapturaWindows]::GetClipboardSequenceNumber()
if ($Metodo -eq 'Recortes') {
    Start-Process 'ms-screenclip:'
} else {
    [CapturaWindows]::keybd_event(0x2C, 0, 0, [UIntPtr]::Zero)
    [CapturaWindows]::keybd_event(0x2C, 0, 2, [UIntPtr]::Zero)
}
Start-Sleep -Milliseconds 3500
$necesitaSeleccion = $Metodo -eq 'Recortes' -or [CapturaWindows]::GetClipboardSequenceNumber() -eq $secuencia
if ($necesitaSeleccion) {
    [void][CapturaWindows]::SetCursorPos(180, 220)
    [CapturaWindows]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [void][CapturaWindows]::SetCursorPos(560, 420)
    Start-Sleep -Milliseconds 100
    [CapturaWindows]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
}
$limite = [DateTime]::UtcNow.AddSeconds(12)
do {
    Start-Sleep -Milliseconds 200
    $cambiado = [CapturaWindows]::GetClipboardSequenceNumber() -ne $secuencia
    if ($cambiado -and [System.Windows.Forms.Clipboard]::ContainsImage()) {
        $imagen = [System.Windows.Forms.Clipboard]::GetImage()
        if ($null -ne $imagen) {
            try {
                Start-Sleep -Milliseconds 600
                $shell = New-Object -ComObject WScript.Shell
                if (-not $shell.AppActivate($TituloVentana)) { throw 'No se ha podido devolver el foco a la ventana de pruebas.' }
                Start-Sleep -Milliseconds 500
                @{ metodo = $Metodo; ancho = $imagen.Width; alto = $imagen.Height; seleccion = $necesitaSeleccion; portapapelesWindows = $true } | ConvertTo-Json -Compress
                exit 0
            } finally { $imagen.Dispose() }
        }
    }
} while ([DateTime]::UtcNow -lt $limite)
[System.Windows.Forms.SendKeys]::SendWait('{ESC}')
throw 'Windows no ha colocado una imagen nueva en el portapapeles; no se da la prueba por válida.'
