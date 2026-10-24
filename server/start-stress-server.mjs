// Arranca el servidor con rate limiting relajado para pruebas de estrés.
process.env.STRESS_TEST = "true";
await import("./src/index.js");
