module.exports = {
  apps: [
    {
      name: 'gbi-backend',
      script: 'dist/main.js',
      cwd: '/root/GBI-Backend',
      instances: 'max', // Run instances across all available CPU cores
      exec_mode: 'cluster', // Enables zero-downtime hot reloading
      env: {
        PORT: 4000,
        NODE_ENV: 'production',
      },
    },
  ],
};
