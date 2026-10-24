// Texto de la autorización RGPD empresa → asesoría. Está VERSIONADO: lo que
// firma la empresa es exactamente este texto, y en el vínculo se guarda la
// versión aceptada. Si el texto cambia algún día, se crea V2 y las firmas
// anteriores siguen siendo válidas con su versión.

export const VERSION_TEXTO = "v1";

export const TEXTO_AUTORIZACION_V1 = `AUTORIZACIÓN DE COMUNICACIÓN DE DOCUMENTACIÓN FISCAL A LA ASESORÍA

1. PARTES

La empresa usuaria de la plataforma FILANEX identificada en el encabezamiento de este documento (en adelante, "la Empresa") autoriza la comunicación de su documentación fiscal a la asesoría igualmente identificada (en adelante, "la Asesoría").

FILATECNICA S.L., como proveedor de la plataforma FILANEX, actúa en este proceso como encargado del tratamiento, limitándose a poner a disposición de la Asesoría los documentos que la Empresa autoriza, sin acceder a su contenido para fines propios.

2. OBJETO

La Empresa autoriza que la Asesoría pueda consultar e incorporar a su gestión, a través de la plataforma FILANEX, los siguientes documentos registrados por la Empresa en la plataforma:

- Facturas de venta emitidas.
- Facturas de compra validadas.
- Tickets y gastos validados.

El acceso se limita a los datos fiscales de dichos documentos (número, fecha, tercero, NIF, base imponible, IVA y total) y a las categorías de documentos que la Empresa haya seleccionado al firmar esta autorización.

3. FINALIDAD

La comunicación de la documentación tiene por única finalidad la prestación por parte de la Asesoría de los servicios de asesoramiento fiscal, contable y/o laboral contratados por la Empresa, incluyendo la confección de libros registro, la preparación de declaraciones tributarias y el cumplimiento de las obligaciones fiscales de la Empresa.

4. BASE JURÍDICA Y CONSERVACIÓN

La base jurídica del tratamiento es el consentimiento de la Empresa, otorgado mediante la aceptación digital de este documento, y la relación contractual existente entre la Empresa y la Asesoría. La documentación importada por la Asesoría se conservará durante los plazos exigidos por la normativa fiscal y contable vigente.

5. REVOCACIÓN

La Empresa puede revocar esta autorización en cualquier momento desde la propia aplicación (Ajustes → Asesoría), sin efectos retroactivos. Desde el momento de la revocación, la Asesoría dejará de tener acceso a los documentos de la Empresa. La documentación que la Asesoría hubiera incorporado legítimamente a su gestión con anterioridad a la revocación podrá conservarse conforme a la normativa aplicable.

6. DERECHOS

La Empresa puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad frente a la Asesoría en los términos previstos en su contrato de asesoramiento, y frente a FILATECNICA S.L. en los términos de su política de privacidad.

7. REGISTRO DE LA ACEPTACIÓN

La aceptación de esta autorización queda registrada con la identificación del usuario que la otorga, la fecha y hora, la dirección IP y la versión del texto aceptado, como prueba del consentimiento.`;

// Datos que rellena el encabezamiento del documento imprimible.
export function datosAutorizacion({ empresa, asesoria, vinculo }) {
  return {
    version: vinculo.autorizacion?.versionTexto ?? VERSION_TEXTO,
    empresa: {
      nombre: empresa.nombre,
      nif: empresa.nif,
    },
    asesoria: {
      nombre: asesoria.nombre,
      nif: asesoria.nif ?? "",
    },
    compartir: vinculo.compartir,
    firmadoPor: vinculo.autorizacion?.usuarioEmail ?? "",
    fechaFirma: vinculo.autorizacion?.fechaAceptacion ?? null,
    ip: vinculo.autorizacion?.ip ?? "",
  };
}
