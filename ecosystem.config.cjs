module.exports = {
  apps: [
    {
      name: 'nexuschain-node',
      script: 'server.ts',
      interpreter: 'tsx', // We use tsx to run typescript directly
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1, // Blockchain node in-memory state requires a single instance
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
