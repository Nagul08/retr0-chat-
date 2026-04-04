const { Redis } = require("@upstash/redis");
const { MAX_STORED_MESSAGES } = require("./config");

const USERS_KEY = "retr0:users";
const MESSAGES_KEY = "retr0:messages";
const MESSAGES_STATE_KEY = "retr0:messages_state";
const PRESENCE_KEY = "retr0:presence";

if (!global.__RETR0_MEM_STORE__) {
  global.__RETR0_MEM_STORE__ = {
    users: {},
    messages: [],
    messagesState: "0",
    presence: {}
  };
}

function hasRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return Boolean(url && token);
}

let redisClient = null;

function getRedis() {
  if (!hasRedisConfig()) {
    return null;
  }

  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    redisClient = new Redis({
      url,
      token
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
    await redis.set(MESSAGES_STATE_KEY, String(Date.now()));
    return;
  }

  global.__RETR0_MEM_STORE__.messages = current;
  global.__RETR0_MEM_STORE__.messagesState = String(Date.now());
}

async function getMessagesState() {
  const redis = getRedis();
  if (redis) {
    const value = await redis.get(MESSAGES_STATE_KEY);
    return value ? String(value) : "0";
  }

  return String(global.__RETR0_MEM_STORE__.messagesState || "0");
}

async function getPresence() {
  const redis = getRedis();
  if (redis) {
    const value = (await redis.get(PRESENCE_KEY)) || {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }
    return {};
  }

  const value = global.__RETR0_MEM_STORE__.presence;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

async function savePresence(presence) {
  const redis = getRedis();
  if (redis) {
    await redis.set(PRESENCE_KEY, presence);
    return;
  }
  global.__RETR0_MEM_STORE__.presence = presence;
}

async function touchPresence(username) {
  try {
    const presence = await getPresence();
    presence[username] = Date.now();
    await savePresence(presence);
  } catch {
    // Presence should never block auth/chat flows.
  }
}

async function getOnlineUsers(windowMs) {
  const threshold = Date.now() - windowMs;
  try {
    const presence = await getPresence();
    const online = Object.entries(presence)
      .filter(([, lastSeen]) => Number(lastSeen) >= threshold)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([username]) => username);

    return online;
  } catch {
    return [];
  }
}

module.exports = {
  getUsers,
  saveUsers,
  getMessages,
  getMessagesState,
  appendMessage,
  touchPresence,
  getOnlineUsers,
  hasRedisConfig
};
