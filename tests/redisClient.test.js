import { expect, use, should } from 'chai';
import chaiHttp from 'chai-http';
import redisClient from '../utils/redis';

use(chaiHttp);
should();

describe('Redis Client', function() {
    let testToken = 'testToken';

    it('should set and get a value in Redis', async function() {
        const value = 'testValue';
        await redisClient.set(testToken, value, 3600); // Set value with an expiration time
        const redisValue = await redisClient.get(testToken);
        expect(redisValue).to.equal(value);
    });

    it('should return null for a non-existing key', async function() {
        const nonExistentKey = 'nonExistentKey';
        const redisValue = await redisClient.get(nonExistentKey);
        expect(redisValue).to.be.null;
    });
});
