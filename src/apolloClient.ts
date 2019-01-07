import { ApolloClient } from 'apollo-client';
import { createUploadLink } from 'apollo-upload-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { setContext } from 'apollo-link-context';
import { onError } from 'apollo-link-error';
import { createPersistedQueryLink } from 'apollo-link-persisted-queries';
import { WebSocketLink } from 'apollo-link-ws';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import MessageTypes from 'subscriptions-transport-ws/dist/message-types';
import { split } from 'apollo-link';
import { getMainDefinition } from 'apollo-utilities';
import { OperationDefinitionNode } from 'graphql';
import { withClientState } from 'apollo-link-state';

import fetch from 'node-fetch';
import ws from 'ws';

import redis from 'redis';
import config = require('config');

// c.f. https://github.com/Akryum/vue-cli-plugin-apollo/blob/master/graphql-client/src/index.js

let TOKEN: string | null = null;
const GRAPHQL_WS = config.get<string>('GRAPHQL_WS');
const GRAPHQL_HTTP = config.get<string>('GRAPHQL_HTTP');

const redisClient = redis.createClient();

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
  uri: GRAPHQL_HTTP,
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
