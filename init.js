const { spawn } = require('child_process');
const { readFile } = require('fs');

if (process.platform === 'win32') return;
return readFile(join(__dirname, 'inited'), (err, data) => {
  if (err) {
    const child = spawn('npm', ['rebuild', '--build-from-source', 'grpc']);

    child.stdout.on('data', data => {
      console.log(data.toString());
    });

    child.on('close', code => {
      if (!code) spawn('touch', ['inited'])
    })

    return child;
  }
})
