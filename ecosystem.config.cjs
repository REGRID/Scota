module.exports = {
  apps: [
    {
      name: 'scota',
      cwd: '/var/www/scota',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 200,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
