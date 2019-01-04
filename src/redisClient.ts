import redis from 'redis';

export const redisClient = redis.createClient();

redisClient.on('error', (err) => {
  // tslint:disable-next-line: no-console
  console.error(`redisClient error: ${err}`);
});
