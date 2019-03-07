const { spawn } = require('child_process');

if (process.platform === 'win32') return;
const child = spawn('npm', ['rebuild', '--build-from-source', 'grpc']);

child.stdout.on('data', data => {
  console.log(data.toString());
});

return child;
