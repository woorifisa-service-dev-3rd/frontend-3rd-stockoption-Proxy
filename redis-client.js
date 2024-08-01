const { createClient } = require("redis");
require("dotenv").config();

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
}

async function fetchDataFromRedisWithKey(key) {
  try {
    const value = await redisClient.get(key);
    return value; // 값 반환
  } catch (error) {
    console.error("An error occurred:", error);
    return null; // 오류 시 null 반환
  }
}

async function saveDataToRedis(key, value) {
  try {
    await redisClient.set(key, value, { EX: 5 });
  } catch (error) {
    console.error("Error saving data to Redis:", error);
  }
}

process.on("exit", async () => {
  console.log("Disconnecting Redis...");
  await redisClient.disconnect();
  console.log("Redis disconnected");
});

module.exports = {
  connectRedis,
  fetchDataFromRedisWithKey,
  saveDataToRedis,
};
