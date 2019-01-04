import config from 'config';
import redis from 'redis';

import { client } from './apolloClient';

const { NODE_ENV } = process.env;

// tslint:disable-next-line: no-console
console.log(client.version);

const serveRoom = (roomId: string) => {
  console.log(`serving room ${roomId}`);
};

const roomSubscriber = redis.createClient();
roomSubscriber.subscribe('writerite:room:activating');

roomSubscriber.on('message', (_channel, message) => {
  serveRoom(message);
});
