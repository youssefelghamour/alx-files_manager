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
    try {
      // Get the token from request headers
      const token = request.headers['x-token'];

      // Check if token is provided
      if (!token) {
        return response.status(401).json({ error: 'No token provided' });
      }

      // Retrieve user ID from Redis using the token
      const userId = await redisClient.get(`auth_${token}`);

      // Check if user ID is not found
      if (!userId) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      // Extract the `id` from the request parameters
      const { id } = request.params;

      // Validate `id` format
      if (!ObjectId.isValid(id)) {
        return response.status(400).json({ error: 'Invalid ID format' });
      }

      // Retrieve the file from the database
      const file = await dbClient.filesCollection.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });

      // Check if file exists
      if (!file) {
        return response.status(404).json({ error: 'File not found' });
      }

      // Send the file data in the response
      return response.status(200).json(file);
    } catch (error) {
      console.error('Error in getShow:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(request, response) {
    try {
      // Get the token from request headers
      const token = request.headers['x-token'];

      // Check if token is provided
      if (!token) {
        return response.status(401).json({ error: 'No token provided' });
      }

      // Retrieve user ID from Redis using the token
      const userId = await redisClient.get(`auth_${token}`);

      // Check if user ID is not found
      if (!userId) {
        return response.status(401).json({ error: 'Unauthorized' });
      }

      // Extract query parameters
      const { parentId = 0, page = 0 } = request.query;
      const pageNumber = parseInt(page, 10);
      const skip = pageNumber * 20;
      const limit = 20;

      // Validate `parentId` to be a valid ObjectId if it's not 0
      const parentObjectId = parentId !== '0' ? new ObjectId(parentId) : parentId;

      // Aggregate pipeline for pagination
      const pipeline = [
        { $match: { userId: new ObjectId(userId), parentId: parentObjectId } },
        { $sort: { name: 1 } }, // Optional: Sort by name or other field
        { $skip: skip },
        { $limit: limit }
      ];

      // Retrieve files from the database
      const files = await dbClient.filesCollection.aggregate(pipeline).toArray();

      // Send the file list in the response
      return response.status(200).json(files);
    } catch (error) {
      console.error('Error in getIndex:', error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
