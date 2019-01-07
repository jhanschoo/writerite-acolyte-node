import { ApolloClient } from 'apollo-client';
import { createUploadLink } from 'apollo-upload-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { setContext } from 'apollo-link-context';
import { onError } from 'apollo-link-error';
import { createPersistedQueryLink } from 'apollo-link-persisted-queries';

import fetch from 'node-fetch';

import config = require('config');
import { createRedis } from './createRedis';
import { IGraphQLConfig } from './types';

// c.f. https://github.com/Akryum/vue-cli-plugin-apollo/blob/master/graphql-client/src/index.js

let TOKEN: string | null = null;
const GRAPHQL = config.get<IGraphQLConfig>('GRAPHQL');

const redisClient = createRedis();

redisClient.get('writerite:acolyte:jwt', (err, token) => {
  if (err) {
    throw err;
  } else {
    TOKEN = token;
    // tslint:disable-next-line: no-console
    console.log('token acquired');
  }
});

const getAuth = () => {
  return TOKEN ? `Bearer ${TOKEN}` : '';
};

const cache = new InMemoryCache();

const httpLink = createUploadLink({
  uri: GRAPHQL.HTTP,
  credentials: 'same-origin',
  fetch,
});

let link = httpLink;

const authLink = setContext((_, { headers }) => {
  const authorization = getAuth();
  const authorizationHeader = authorization ? { authorization } : {};
  return {
    headers: {
      ...headers,
      ...authorizationHeader,
    },
  };
});

link = authLink.concat(link);

// hash large queries

link = createPersistedQueryLink().concat(link);

link = onError(({ graphQLErrors }) => {
  if (graphQLErrors) {
    // tslint:disable-next-line: no-console
    graphQLErrors.map(({ message }) => console.log(message));
  }
}).concat(link);

// end to disable if SSR

const client = new ApolloClient({
  link,
  cache,
  ssrForceFetchDelay: 100,
});

export { client };
