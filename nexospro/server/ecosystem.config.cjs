// Configuración de PM2 para producción.
// Uso: pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "filanex-api",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/filanex/error.log",
      out_file: "/var/log/filanex/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
