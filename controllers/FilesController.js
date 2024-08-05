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

    const { id } = request.params;
    const file = await dbClient.filesCollection.findOne({ _id: new ObjectId(id) });
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.status(200).json(file);
  }

  static async getIndex(request, response) {
    const token = request.headers['x-token'];

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId, page } = request.query;
    const pageNum = page || 0;
    let query;
    if (!parentId) {
      query = { userId: userId };
    } else {
      query = { userId: userId, parentId: ObjectID(parentId) };
    }
    dbClient.filesCollection.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) {
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        // console.log(final);
        return response.status(200).json(final);
      }
      console.log('Error occured');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }
}

export default FilesController;
