import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const database = process.env.DB_DATABASE || 'files_manager';

    this.url = `mongodb://${host}:${port}`;

    this.client = new MongoClient(this.url, { useNewUrlParser: true, useUnifiedTopology: true });

    this.client.connect().then(() => {
      this.db = this.client.db(database);
      console.log('Connected to MongoDB');
    }).catch((err) => {
      console.error(`Failed to connect to MongoDB: ${err.message}`);
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
