import firebase from 'firebase';
import device from 'rpi-rrda-device';
import Emitter from 'events';
import { readFile, writeFile } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { promisify } from 'util';
import { on, off, dim } from 'rrda';
import ClockScript from './clock-script';

const read = promisify(readFile);
const write = promisify(writeFile);

const emitter = new Emitter();

const HOME = homedir();

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

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
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
}

const deviceState = async () => {
  // TODO: write mode
  let data;
  try {
    data = await read(join(HOME, '.firebase-rrda-device'));
    data = JSON.parse(data.toString());
  } catch (e) {
    data = {
      mode: 1,
      ap: {},
      user: {}
    };
  }
  return data;
}

// TODO: add option to login using google
export default async user => {
  let deviceRef;
  let clock;
  const { uid } = await device();
  const state = await deviceState();
  let { mode, ap } = state;
  if (!user) user = state.user;
  // device is in accespoint mode
  if (mode === 1) {
    // await waitTill()
  }
  if (!ap) ap = {};
  if (!user.username) {
    user.username = process.argv.indexOf('username')
    user.username = process.argv[user.username + 1];
    if (user.username) await write(join(HOME, '.firebase-rrda-device'), JSON.stringify({user, ap}));
  }
  if (!user.password) {
    user.password = process.argv.indexOf('password')
    user.password = process.argv[user.password + 1];
    if (user.password) await write(join(HOME, '.firebase-rrda-device'), JSON.stringify({user, ap}));
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      deviceRef = firebase.database().ref(`${user.uid}/${uid}`);

      const init = () => deviceRef.set({ ...defaultOptions, ...{ id: uid } });

      const snapIt = async snap => {
        const key = snap.key;
        const value = snap.val();
        if (!value && value !== 0) return init().then(() => deviceRef.once('value').then(snapIt));
        if (key === uid) {
          // on || off
          if (value.on) await on(1);
          else await off(1);

          emitter.emit('on', value.on);

          // dim percentage
          await dim(value.dim);
          emitter.emit('dim', value.dim);

          // clock config
          emitter.emit('clock', value.clock); // maybe remove ...
          // if (clock && clock.running) clock.stop();
          clock = new ClockScript(deviceRef, value.clock);
          if (value.enabled) clock.run();
        } else {
          if (key === 'clock') {
            if (clock && clock.running) {
              clock.config = value;
              clock.run();
            } else clock = new ClockScript(deviceRef, value);
          } else if (key === 'on') {
            if (value) await on(1);
            else await off(1)
          } else if (key === 'dim') {
            await dim(value)
          } else if (key === 'enabled') {
            if (value && !clock.running) clock.run();
            else if (!value && clock.running) clock.stop(clock.current.timeout, clock.current.job);
          }
          emitter.emit(key, value);
        }

      }
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
}
