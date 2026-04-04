const { Redis } = require("@upstash/redis");
const { MAX_STORED_MESSAGES } = require("./config");

const USERS_KEY = "retr0:users";
const MESSAGES_KEY = "retr0:messages";

if (!global.__RETR0_MEM_STORE__) {
  global.__RETR0_MEM_STORE__ = {
    users: {},
    messages: []
  };
}

function hasRedisConfig() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redisClient = null;

function getRedis() {
  if (!hasRedisConfig()) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
  }

  return redisClient;
}

async function getUsers() {
  const redis = getRedis();
  if (redis) {
    return (await redis.get(USERS_KEY)) || {};
  }
  return global.__RETR0_MEM_STORE__.users;
}

async function saveUsers(users) {
  const redis = getRedis();
  if (redis) {
    await redis.set(USERS_KEY, users);
    return;
  }
  global.__RETR0_MEM_STORE__.users = users;
}

async function getMessages() {
  const redis = getRedis();
  if (redis) {
    return (await redis.get(MESSAGES_KEY)) || [];
  }
  return global.__RETR0_MEM_STORE__.messages;
}

async function appendMessage(message) {
  const current = await getMessages();
  current.push(message);
  if (current.length > MAX_STORED_MESSAGES) {
    current.splice(0, current.length - MAX_STORED_MESSAGES);
  }

  const redis = getRedis();
  if (redis) {
    await redis.set(MESSAGES_KEY, current);
    return;
  }

  global.__RETR0_MEM_STORE__.messages = current;
}

module.exports = {
  getUsers,
  saveUsers,
  getMessages,
  appendMessage,
  hasRedisConfig
};
