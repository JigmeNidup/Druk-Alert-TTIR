module.exports = {
  apps: [
    {
      name: "drukalert-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
    },
    {
      name: "drukalert-worker",
      cwd: __dirname,
      script: "src/worker/mqtt.ts",
      interpreter: "node",
      node_args: "--env-file=.env --import tsx",
      autorestart: true,
    },
  ],
};
