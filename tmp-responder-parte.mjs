import mongoose from "mongoose";

const RESPUESTA = `Hola Raquel: ya está arreglado, y te explico el porqué del formato nuevo.

El parte de trabajo ahora imprime TODO lo que anotáis en "Trabajo solicitado": si hay muchos trabajos, la letra se ajusta sola y, si aun así no cabe, la caja crece hacia abajo. No se vuelve a cortar ningún renglón y no hace falta apuntar a boli.

¿Por qué van ahora los trabajos seguidos en la misma línea separados por "·"? Porque antes cada trabajo ocupaba su propio renglón de arriba a abajo y la caja se llenaba enseguida, obligando a encoger la letra demasiado para que cupiera todo. Al ponerlos en línea, la letra se mantiene grande (como pedíais al principio) y todo cabe. Si queréis separar bloques (por ejemplo "POR CUENTA DEL CLIENTE"), dejad una línea en blanco entre bloques y cada uno sale en su propio párrafo.

Una cosa importante: el programa está en la nube y, si se deja abierto sin cerrar, los arreglos no llegan hasta que no se refresca. Al empezar la jornada, cerrad y volved a abrir el programa (o pulsad F5); es gratis y tarda 10 segundos.

Probad con la próxima OT que tenga varios trabajos y confirmadme que sale todo entero, así cierro el caso. Gracias por la paciencia.`;

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
const r = await conn.db.collection("propuestas").updateOne(
  { _id: new mongoose.Types.ObjectId("6ad7145aa7a301eacc3e75a0") },
  {
    $set: {
      respuesta: RESPUESTA,
      respuestaFecha: new Date(),
      respuestaLeida: false,
      respondidaPor: "soporte",
      estado: "realizada",
    },
  }
);
console.log("Respuesta publicada:", JSON.stringify(r));
await conn.close();
