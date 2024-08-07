import { expect, use, should } from 'chai';
import chaiHttp from 'chai-http';
import { ObjectId } from 'mongodb';
import app from '../server';
import dbClient from '../utils/db';

use(chaiHttp);
should();

describe('Database Client', function() {
    let testUserId = '';

    it('should connect to the database and create a user', async function() {
        const user = { email: 'test@domain.com', password: 'password' };
        const response = await chai.request(app).post('/users').send(user);
        const body = JSON.parse(response.text);
        expect(response.statusCode).to.equal(201);
        expect(body.email).to.equal(user.email);
        expect(body).to.have.property('id');

        testUserId = body.id;

        const userMongo = await dbClient.usersCollection.findOne({ _id: ObjectId(testUserId) });
        expect(userMongo).to.exist;
    });
});
