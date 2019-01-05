import config from 'config';
import redis from 'redis';
import gql from 'graphql-tag';

import { client } from './apolloClient';

const { NODE_ENV } = process.env;

// tslint:disable-next-line: no-console
console.log(client.version);

interface IRwCard {
  id: string;
  front: string;
  back: string;
}

const ROOM_INFO_QUERY = gql`
query RoomInfo($roomId: ID!) {
  rwRoom(id: $roomId) {
    id
    name
    deck {
      id
      name
      cards {
        id
        front
        back
      }
    }
  }
}
`;

interface IRoomInfoVariables {
  roomId: string;
}

interface IRoomInfoData {
  rwRoom: null | {
    id: string;
    name: string;
    deck: {
      id: string;
      name: string;
      cards: IRwCard[];
    }
  };
}

const MESSAGE_CREATE_MUTATION = gql`
mutation MessageCreate($roomId: ID! $content: String!) {
  rwRoomMessageCreate(roomId: $roomId content: $content) {
    id
    content
  }
}
`;

interface IMessageCreateVariables {
  roomId: string;
  content: string;
}

interface IMessageCreateData {
  rwRoomMessageCreate: {
    id: string,
    content: string,
  };
}

const getRoomInfo = async (roomId: string) => {
  // fetch room info
  return client.query<IRoomInfoData, IRoomInfoVariables>({
    query: ROOM_INFO_QUERY,
    variables: {
      roomId,
    },
  });
};

const sendMessageFactory = (roomId: string) => (content: string) => {
  return client.mutate<IMessageCreateData, IMessageCreateVariables>({
    mutation: MESSAGE_CREATE_MUTATION,
    variables: {
      roomId,
      content,
    },
  });
};

const serveRoom = async (_channel: string, roomId: string) => {
  const sendMessage = sendMessageFactory(roomId);
  sendMessage('Indoctrinating acolyte...');

  const messageSubscriber = redis.createClient();
  const room = await getRoomInfo(roomId);
  if (!room.data || !room.data.rwRoom) {
    throw new Error('Unable to obtain room info');
  }
  const cards = room.data.rwRoom.deck.cards;
  let currentBack: string | null = null;

  const serveNextCard = (i: number) => {
    if (i >= cards.length) {
      sendMessage('deck has been served!');
    } else {
      const card = cards[i];
      currentBack = card.back;
      sendMessage(`Next card: ${card.front}`);
      setTimeout(serveNextCard, 10_000, ++i);
    }
  };
  serveNextCard(0);

  const handleUserMessage = async (_roomChannel: string, content: string) => {
    const separator = content.indexOf(':');
    const userId = content.slice(0, separator);
    const message = content.slice(separator + 1);
    if (message === currentBack) {
      sendMessage('You got it!');
    }
    // TODO
  };

  messageSubscriber.subscribe(`writerite:room::${roomId}`);
  messageSubscriber.on('message', handleUserMessage);
};

const roomSubscriber = redis.createClient();
roomSubscriber.subscribe('writerite:room:activating');

roomSubscriber.on('message', serveRoom);
