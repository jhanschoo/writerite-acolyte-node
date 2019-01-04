import { ApolloClient } from 'apollo-client';
import { createUploadLink } from 'apollo-upload-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { setContext } from 'apollo-link-context';
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

import { redisClient } from './redisClient';
import config = require('config');

// c.f. https://github.com/Akryum/vue-cli-plugin-apollo/blob/master/graphql-client/src/index.js

let TOKEN: string | null = null;
const GRAPHQL_WS = config.get<string>('GRAPHQL_WS');
const GRAPHQL_HTTP = config.get<string>('GRAPHQL_HTTP');

redisClient.get('writerite:acolyte:jwt', (err, token) => {
  if (err) {
    throw err;
  } else {
    TOKEN = token;
    // tslint:disable-next-line: no-console
    console.log(`token acquired: ${token}`);
    restartWsConnection();
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

// ws

const wsClient = new SubscriptionClient(
  GRAPHQL_WS, {
    reconnect: true,
    connectionParams: () => {
      // tslint:disable-next-line: variable-name
      const Authorization = getAuth();
      return Authorization ? { Authorization } : {};
    },
  },
  ws,
);

const wsLink = new WebSocketLink(wsClient);

link = split(({ query }) => {
  const { kind, operation } = getMainDefinition(query) as OperationDefinitionNode;
  return kind === 'OperationDefinition' &&
    operation === 'subscription';
}, wsLink, link);

const stateLink = withClientState({
  cache,
  resolvers: {},
});

// end to disable if SSR

const client = new ApolloClient({
  link,
  cache,
  ssrForceFetchDelay: 100,
});

client.onResetStore(() => Promise.resolve(stateLink.writeDefaults()));

export { client, wsClient };

// see following for authentication strategies. Note we are using
// a private API due to the inability of the public API to handle
// reconnects
// https://github.com/apollographql/subscriptions-transport-ws/issues/171
export const restartWsConnection = (): void => {
  // Copy current operations
  const operations = Object.assign({}, wsClient.operations);

  // Close connection
  wsClient.close();

  // Open a new one
  // @ts-ignore
  wsClient.connect();

  // Push all current operations to the new connection
  Object.keys(operations).forEach((id) => {
    // @ts-ignore
    wsClient.sendMessage(
      id,
      MessageTypes.GQL_START,
      operations[id].options,
    );
  });
};
