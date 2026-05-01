module.exports = {
    apps: [{
        name: 'darwa-ride',
        script: 'backend/server.js',
        cwd: '/var/www/darwa-ride',
        exec_mode: 'fork',
        instances: 1,
        max_memory_restart: '600M',
        env: {
            NODE_ENV: 'production',
            PORT: 3500
        },
        error_file: '/var/log/pm2/darwa-ride-error.log',
        out_file: '/var/log/pm2/darwa-ride-out.log',
        merge_logs: true,
        time: true
    }]
};
