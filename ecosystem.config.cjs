/**
 * PM2 process file — run from repo root (same directory as server.js).
 *
 * Usage:
 *   npx pm2 start ecosystem.config.cjs
 *   npx pm2 save
 *   npx pm2 startup   # follow the printed command for launchd/systemd
 */
module.exports = {
  apps: [
    {
      name: "ifcdc-backend",
      script: "server.js",
      cwd: __dirname,
      interpreter: "node",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      min_uptime: "5s",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
}
