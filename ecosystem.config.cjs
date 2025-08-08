module.exports = {
  apps: [{
    name: 'nagaiku-budget-v2',
    script: 'npm',
    args: 'run dev',
    cwd: '/home/tanaka/projects/nagaiku-budget-v2',
    interpreter: 'none',
    env: {
      NODE_ENV: 'development'
    },
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};