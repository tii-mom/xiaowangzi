module.exports = {
  apps: [
    {
      name: 'xiaowangzi',
      script: '.next/standalone/server.js',
      cwd: '/Users/yudeyou/Desktop/wangzi/xiaowangzi',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_file: '/Users/yudeyou/Desktop/wangzi/xiaowangzi/.env',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
      },
      out_file: '/var/log/xiaowangzi/pm2-out.log',
      error_file: '/var/log/xiaowangzi/pm2-error.log',
      log_file: '/var/log/xiaowangzi/pm2-combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      restart_delay: 3000,
    },
  ],
};
