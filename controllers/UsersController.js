import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    console.log(req.body);
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // check if the email already exists
    const existingUser = await dbClient.usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // hash the password
    const hashedPassword = sha1(password);

    // create and insert the new user
    const result = await dbClient.usersCollection.insertOne({ email, password: hashedPassword });
    const newUser = result.insertedId;

    // return the new user
    return res.status(201).json({ id: newUser, email });
  }

  static async getMe(request, response) {
    // Get the token from the request header
    const token = request.header('X-Token');

    // Check if the token exists
    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Generate the Redis key
    const redisKey = `auth_${token}`;

    // Retrieve the user ID from Redis using the token
    const userId = await redisClient.get(redisKey);

    // If no user ID is found, respond with Unauthorized
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const objectId = ObjectId(userId);
    // Retrieve the user from the database
    const user = await dbClient.usersCollection.findOne({ _id: objectId });

    // If no user is found, respond with Unauthorized
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Respond with the user id and email
    const userInfo = { id: user._id, email: user.email };
    return response.status(200).json(userInfo);
  }
}

export default UsersController;
