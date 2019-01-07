import config from 'config';

const PATHS = [
  'GRAPHQL.HTTP',
  'GRAPHQL.WS',
  'REDIS.HOST',
  'REDIS.PORT',
];

PATHS.forEach((path) => {
  if (!config.has(path)) {
    throw new Error(`configuration value ${path} not found`);
  }
});
