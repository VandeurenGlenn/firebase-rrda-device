const connection = require('./');

const user = {
  username: 'test@domain.org',
  password: 'domain.org'
};

(async () => {
  const devConnection = await connection(user);
  devConnection.on('on', on => {
    console.log({ on });
  });

  devConnection.on('dim', dim => {
    console.log({ dim });
  });

  devConnection.on('clock', clock => {
    console.log({ clock });
  });
})()
