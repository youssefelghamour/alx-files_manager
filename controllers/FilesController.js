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
}

export default FilesController;