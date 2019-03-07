# firebase-rrda-device
> Control your rrda device with firebase

creates a unique uid on the device and pushes a basic rrda  (remote relay dimming api) config
this exist out of the 'on', 'id' and 'clock' properties
## usage

```js

const device = require('firebase-rrda-device');
const { Gpio } = require('onoff');

const gpio = new Gpio(21, 'out');
const user = {
  username: 'test@domain.org',
  password: 'domain.org'
};

(async () => {
  const dev = await device(user);
  dev.on('on', on => {
    console.log({ on });
    gpio.write(on)
  });
})()

```

## API
### firebaseRrdaDevice([options])
#### options
##### setOn()
```js
device.setOn(0) // off
device.setOn(1) // on
```
##### setClock()
```js
const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const start = { hour: 17, minutes: 0 };
const stop = { hour: 24, minutes: 0 };
const clock = days.map(day => {
    return {
      day,
      start,
      stop
    }
  });
device.setClock(clock)
```
##### setDim()
```js
device.setDim(0) // 0%
device.setDim(10) // 10%
```
## TODO
- APmode
- finish doc
