import mongoose from 'mongoose';
const plataforma = await mongoose.connect('mongodb://localhost:27017/filanex_plataforma');
const tenants = await plataforma.connection.collection('tenants').find({}).toArray();
const nombres = tenants.map((t) => ({ slug: t.slug ?? t.nombre, db: t.dbNombre ?? `filanex_${t.slug ?? t.nombre}` }));
console.log('TENANTS:', nombres.map((n) => n.db).join(', '));
await mongoose.disconnect();

for (const { slug, db } of nombres) {
  if (db === 'filanex_montiel') continue;
  await mongoose.connect(`mongodb://localhost:27017/${db}`);
  const props = await mongoose.connection.collection('propuestas')
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  if (props.length) {
    console.log(`\n########## ${slug} (${db}) ##########`);
    for (const p of props) {
      console.log('-'.repeat(60));
      console.log('ID:', p._id, '| estado:', p.estado, '| fecha:', p.createdAt?.toISOString?.());
      console.log('AUTOR:', p.autorNombre ?? p.autor ?? p.usuario ?? '(?)');
      console.log('TEXTO:', (p.texto ?? p.mensaje ?? '').slice(0, 500));
      console.log('RESPUESTA:', p.respuesta ? p.respuesta.slice(0, 120) : '(sin respuesta)');
      console.log('respuestaLeida:', p.respuestaLeida);
    }
  }
  await mongoose.disconnect();
}
process.exit(0);
