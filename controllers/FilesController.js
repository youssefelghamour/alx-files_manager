import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(request, response) {
    // Get the token from request headers
    const token = request.headers['x-token'];

    // Retrieve user ID from Redis using the token
    const userId = await redisClient.get(`auth_${token}`);

    // Check if user ID is not found
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Extract data from request body
    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = request.body;

    // Check if name is missing
    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }

    // Validate type
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return response.status(400).json({ error: 'Missing or invalid type' });
    }

    // Check if data is missing for non-folder types
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    // Check if there is a parent ID
    if (parentId !== 0) {
      // Find parent file in database
      const parentFile = await dbClient.filesCollection.findOne({ _id: new ObjectId(parentId) });

      // Check if parent file does not exist or is not a folder
      if (!parentFile) {
        return response.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Initialize localPath variable
    let localPath = '';

    // Check if type is not folder
    if (type !== 'folder') {
      // Set folder path from environment variable or default
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

      // Create the folder if it does not exist
      fs.mkdirSync(folderPath, { recursive: true });

      // Generate a unique path for the file using UUID
      localPath = path.join(folderPath, uuidv4());

      // Write file data to the generated path
      fs.writeFileSync(localPath, Buffer.from(data, 'base64'));
    }

    // Create a new file object
    const newFile = {
      userId,
      name,
      type,
      isPublic,
      parentId,
      localPath: type !== 'folder' ? localPath : undefined,
    };

    // Insert new file data into the database
    const result = await dbClient.filesCollection.insertOne(newFile);

    // Respond with the created file data
    return response.status(201).json({ id: result.insertedId.toString(), ...newFile });
  }

  static async getShow(request, response) {
    const token = request.headers['x-token'];

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const fileObjectId = new ObjectId(fileId);
    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: fileObjectId, userId: user._id });
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.json(file);
  }

  static async getIndex(request, response) {
    const token = request.headers['x-token'];

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = parseInt(request.query.parentId, 10) || 0;
    const pagination = parseInt(request.query.page, 10) || 0;

    const aggregationMatch = { parentId };
    const aggregateData = [
      { $match: aggregationMatch },
      { $skip: pagination * 20 },
      { $limit: 20 },
    ];

    const files = await dbClient.db.collection('files').aggregate(aggregateData);
    const filesArray = [];
    await files.forEach((item) => {
      filesArray.push(item);
    });

    return response.json(filesArray);
  }

  static async putPublish(response, request) {
    const token = request.headers['x-token'];

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    let file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: user._id });
    if (!file) {
      response.status(404).json({ error: 'Not found' });
    }

    await dbClient.db
      .collection('files')
      .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: user._id });

    return response.json(file);
  }

  static async putUnpublish(request, response) {
    const token = request.headers['x-token'];

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    let file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: user._id });
    if (!file) {
      response.status(404).json({ error: 'Not found' });
    }

    await dbClient.db
      .collection('files')
      .updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

    file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(fileId), userId: user._id });

    return response.json(file);
  }
}

export default FilesController;
