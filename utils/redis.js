import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();

    this.connected = true;

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);

    // Handle Redis client errors
    this.client.on('error', (error) => {
      console.error(`Redis client error: ${error.message}`);
      this.connected = false;
    });

    // Update the connected status on successful connection
    this.client.on('connect', () => {
      this.connected = true;
    });

    // Update the connected status on disconnect
    this.client.on('end', () => {
      this.connected = false;
    });
  }

  // Checks if connection to Redis is successful
  isAlive() {
    return this.connected;
  }

  // Gets value corresponding to the key in Redis
  async get(key) {
    const value = await this.getAsync(key);
    return value;
  }

  // Creates a new key in Redis with a specific expiration
  async set(key, value, duration) {
    await this.setAsync(key, duration, value);
  }

  // Deletes a key in Redis
  async del(key) {
    await this.delAsync(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
