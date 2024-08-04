import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(request, response) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    if (!email || !password) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPassword = sha1(password);
    const user = await dbClient.usersCollection.findOne({ email, password: hashedPassword });

    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 24 * 60 * 60);

    return response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.headers['x-token'];

    // Check if the token is present
    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Generate the Redis key
    const redisKey = `auth_${token}`;

    // Retrieve the user ID from Redis
    const userId = await redisClient.get(redisKey);

    // If no user ID is found, respond with Unauthorized
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve the user from the database
    const objectId = ObjectId(userId);
    const user = await dbClient.usersCollection.findOne({ _id: objectId });

    // If no user is found in the database, respond with Unauthorized
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token from Redis
    await redisClient.del(redisKey);

    return response.status(204).send();
  }
}

export default AuthController;
