import { IRedisConfig } from './types';
import config from 'config';
import Redis from 'ioredis';

import './assertConfig';

const REDIS = config.get<IRedisConfig>('REDIS');
const redisOptions = {
  host: REDIS.HOST,
  port: parseInt(REDIS.PORT, 10),
  db: 2,
};

export const createRedis = () => {
  return new Redis(redisOptions);
};
