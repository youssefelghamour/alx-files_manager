import sha1 from 'sha1';
import dbClient from '../utils/db';

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
}

export default UsersController;
