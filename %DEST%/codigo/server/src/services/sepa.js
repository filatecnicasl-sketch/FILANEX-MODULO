// Generación de remesas SEPA de domiciliación bancaria (pain.008.001.02).
// XML determinista: el banco del usuario es quien valida el esquema.

const escaparXml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const iso = (d) => d.toISOString().slice(0, 10);
const isoHora = (d) => d.toISOString().slice(0, 19);

export function xmlRemesaSepa({ empresa, fechaCargo, recibos }) {
  // recibos: [{ cliente: {nombre}, iban, importe, referencia }]
  const msgId = `NEXOSPRO-${Date.now()}`;
  const pmtInfId = `${msgId}-1`;
  const total = recibos.reduce((s, r) => s + r.importe, 0).toFixed(2);
  const ahora = new Date();

  const txs = recibos
    .map(
      (r, i) => `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${escaparXml(r.referencia)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${r.importe.toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>CLI-${escaparXml(String(r.clienteId))}</MndtId>
            <DtOfSgntr>${iso(ahora)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${escaparXml(r.cliente)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${escaparXml(r.iban.replace(/\s/g, "").toUpperCase())}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${escaparXml(r.concepto)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${isoHora(ahora)}</CreDtTm>
      <NbOfTxs>${recibos.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <InitgPty><Nm>${escaparXml(empresa.nombre)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${recibos.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>${iso(fechaCargo)}</ReqdColltnDt>
      <Cdtr><Nm>${escaparXml(empresa.nombre)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${escaparXml(empresa.sepa.iban.replace(/\s/g, "").toUpperCase())}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>
      <CdtrSchmeId><Id><PrvtId><Othr><Id>${escaparXml(empresa.sepa.idAcreedor)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>${txs}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}
