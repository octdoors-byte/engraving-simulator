// PM2設定ファイル
// 使用方法: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: "engraving-simulator",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      },
      // ログ設定
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // 自動再起動設定
      watch: false,
      max_memory_restart: "500M",
      // クラッシュ時の再起動
      min_uptime: "10s",
      max_restarts: 10,
      // グレースフルシャットダウン
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
