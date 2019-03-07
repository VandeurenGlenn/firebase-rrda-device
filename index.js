'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var firebase = _interopDefault(require('firebase'));
var device = _interopDefault(require('rpi-rrda-device'));
var Emitter = _interopDefault(require('events'));
var fs = require('fs');
var path = require('path');
var os = require('os');
var util = require('util');

const ms = {
  hour: ms => (Number(ms) / 60000) / 60
};

const minutes = {
  ms: minutes => Number(minutes) * 0.6e+5
};

const hour =  {
  minutes: hour => Number(hour) * 60,
  ms: hour => Number(hour) * 3.6e+6
};

var tc = {
  ms,
  hour,
  minutes
};

const log = text => console.log(`${String(new Date()).split('GMT')[0]} - ${JSON.stringify(text)}`);

const numberizeTimeObject = ob => {
  ob.hour = Number(ob.hour);
  ob.minutes = Number(ob.minutes);
  return ob;
};

const afterStopTime = async (hours, minutes, day, config) => {
  const nextDay = await nextStartDay(config, day);
  const till = { hour: 24 - Number(hours), minutes: 60 - Number(minutes) };
  let { start } = { ...config[nextDay] };
  start = numberizeTimeObject(start);
  // get time till next day and add start time
  return tc.hour.ms(till.hour + start.hour) + tc.minutes.ms(till.minutes + start.minutes);
};

const nextStartDay = async (days, day) => {
  if (day === 6) day = -1;
  let nextDay;
  for (var i = 0; i < 6; i++) {
    day += 1;
    nextDay = days[day];
    if (nextDay.start) return day;
  }

};

// TODO: set option to edit dim value {day start stop dims: [[time, dim], [time, dim], ...]}
class ClockScript {
    constructor(ref, config) {
      this.ref = ref;
      this.config = config;

      this.run();
    }

    on() {
      this.ref.child('on').set(1);
    }

    off() {
      this.ref.child('on').set(0);
    }

    dim(value) {
      this.ref.child('dim').set(Number(value));
    }

    async run() {
      if (this.running && this.current || this.current && this.busy) await this.stop(this.current.timeout, this.current.job);
      return this.clock(this.config);
    }

    async stop(timeout, job) {
      await this.current.stop(this.current.timeout, this.current.job);
      return;
    }

    requestTimeout(time, config, job) {
      this.timeout = setTimeout(() => {
        this.running = false;
        this.clock(config);
      }, time > 0 ? time : -time);

      this.currrent = {
        timeout: this.timeout,
        job,
        stop: (timeout, job) => {
          clearTimeout(timeout);
          this.running = false;
          console.log('job cancelled: ', job);
        }
      };

      console.group('requesting job timeout');
      console.log(`ms: ${time}`);
      console.log(`job: ${job}`);

      const logTime = String(tc.ms.hour(time)).split('.');
      console.log(`next job runs in ${logTime[0]} hours & ${Math.round(tc.hour.minutes(`0.${logTime[1]}`))} minutes`);
      console.groupEnd();
    }

    async clock(config) {
      if (this.running && this.current && this.current.job) {
	       this.current.stop(this.current.timeout, this.current.job);
      }
      this.busy = true;
      this.running = true;

      const date = new Date();
      const day = date.getDay();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      this.job = Date.now();

      console.log('config for today', config[day]);

      if (!config[day]) {
        this.time = await afterStopTime(hours, minutes, day, config);
        this.requestTimeout(this.time, config, this.job);
        this.off();
      } else if (config[day]) {
        // get start/stop time
        let { start, stop } = { ...config[day] };
        start = numberizeTimeObject(start);
        stop = numberizeTimeObject(stop);

        if (start.hour === 0) start.hour = 24;
        if (stop.hour === 0) stop.hour = 24;
        // if (start.minutes === 0) start.minutes = 60;
        // if (stop.minutes === 0) stop.minutes = 60;

        const minutesMs = val => tc.minutes.ms(val - minutes);

        const hourMs = val => tc.hour.ms(val - hours);

        const offTime = () => hourMs(start.hour) + minutesMs(start.minutes);

        const onTime = () =>  hourMs(stop.hour) + minutesMs(stop.minutes);

        if (hours >= stop.hour && minutes >= stop.minutes) {
          log('case 1: hours are greater or same as stop, the same can be said for minutes');
          this.requestTimeout(offTime(), config, this.job);
          this.off();
        } else {
          if (hours < start.hour && hours < stop.hour) {
            log('case 2: hours are smaller than start or stop');
            this.requestTimeout(offTime(), config, this.job);
            // do nothing, the user manually turned it on
            this.off();
          } else if (hours >= start.hour && hours <= stop.hour) {
            log('case 3: hours are greater than start or stop');

            if (hours === stop.hour && minutes >= stop.minutes) {
              log('case 4');
              this.requestTimeout(offTime(), config, this.job);
              this.off();
            } else if (minutes >= start.minutes && hours >= start.hour) {
              log('case 5');
              this.requestTimeout(onTime(), config, this.job);
              this.on();
            } else if (hours > start.hour) {
              log('case 6');
              this.requestTimeout(onTime(), config, this.job);
              this.on();
            }
          }
        }
      }
      this.busy = false;
    }
  }

const read = util.promisify(fs.readFile);
const write = util.promisify(fs.writeFile);

const emitter = new Emitter();

const HOME = os.homedir();

const config = {
    apiKey: "AIzaSyD5bzp8xFaYkJE52SjoHb_MpGOPnxmACnU",
    authDomain: "rd-home-control.firebaseapp.com",
    databaseURL: "https://rd-home-control.firebaseio.com",
    projectId: "rd-home-control",
    storageBucket: "rd-home-control.appspot.com",
    messagingSenderId: "752149655188"
};

firebase.initializeApp(config);

const app = firebase.app();

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const start = { hour: 17, minutes: 0 };
const stop = { hour: 24, minutes: 0 };

const defaultOptions = {
  on: 0,
  dim: 0,
  clock: days.map(day => {
    return {
      day,
      start,
      stop
    }
  })
};

const deviceState = async () => {
  // TODO: write mode
  let data;
  try {
    data = await read(path.join(HOME, 'firebase-rrda-device'));
    data = JSON.parse(data.toString());
  } catch (e) {
    data = {
      mode: 1,
      ap: {},
      user: {}
    };
  }
  return data;
};

// TODO: add option to login using google
var index = async user => {
  let deviceRef;
  let clock;
  const { uid } = await device();
  const state = await deviceState();
  let { mode, ap } = state;
  if (!user) user = state.user;
  if (!ap) ap = {};
  if (!user.username) {
    user.username = process.argv.indexOf('username');
    user.username = process.argv[user.username + 1];
    if (user.username) await write(path.join(HOME, 'firebase-rrda-device'), JSON.stringify({user, ap}));
  }
  if (!user.password) {
    user.password = process.argv.indexOf('password');
    user.password = process.argv[user.password + 1];
    if (user.password) await write(path.join(HOME, 'firebase-rrda-device'), JSON.stringify({user, ap}));
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      deviceRef = firebase.database().ref(`${user.uid}/${uid}`);

      const init = () => deviceRef.set({ ...defaultOptions, ...{ id: uid } });

      const snapIt = snap => {
        const key = snap.key;
        const value = snap.val();
        if (!value && value !== 0) return init().then(() => deviceRef.once('value').then(snapIt));
        if (key === uid) {
          // on || off
          emitter.emit('on', value.on);

          // dim percentage
          emitter.emit('dim', value.dim);

          // clock config
          emitter.emit('clock', value.clock); // maybe remove ...
          // if (clock && clock.running) clock.stop();
          clock = new ClockScript(deviceRef, value.clock);
        } else {
          if (key === 'clock') {
            if (clock && clock.running) {
              clock.config = value;
              clock.run();
            } else clock = new ClockScript(deviceRef, value);
          }
          emitter.emit(key, value);
        }

      };
      deviceRef.once('value').then(snapIt);
      deviceRef.on('child_changed', snapIt);
    }
  });
  if (user.username && user.password) firebase.auth().signInWithEmailAndPassword(user.username, user.password);
  else throw 'expected username & password to be defined'; // TODO: replace with local socket request for password and username

  return {
    on: (ev, cb) => emitter.on(ev, cb),
    once: (ev, cb) => emitter.once(ev, cb),
    setOn: val => deviceRef.child('on').set(val),
    setDim: val => deviceRef.child('dim').set(val),
    setClock: val => deviceRef.child('clock').set(val),
  }
};

module.exports = index;
