import {
  expect, use, should, request,
} from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import app from '../server';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

use(chaiHttp);
should();

describe('API Endpoints', function() {
    const credentials = 'Basic Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=';
    let token = '';
    let userId = '';

    describe('POST /users', function() {
        it('should create a user and return the id and email', async function() {
            const user = { email: 'bob@dylan.com', password: 'toto1234!' };
            const response = await chai.request(app).post('/users').send(user);
            const body = JSON.parse(response.text);
            expect(body.email).to.equal(user.email);
            expect(body).to.have.property('id');
            expect(response.statusCode).to.equal(201);

            userId = body.id;
            const userMongo = await dbClient.usersCollection.findOne({ _id: ObjectId(body.id) });
            expect(userMongo).to.exist;
        });

        it('should fail if password is missing', async function() {
            const user = { email: 'bob@dylan.com' };
            const response = await chai.request(app).post('/users').send(user);
            const body = JSON.parse(response.text);
            expect(body).to.eql({ error: 'Missing password' });
            expect(response.statusCode).to.equal(400);
        });

        it('should fail if email is missing', async function() {
            const user = { password: 'toto1234!' };
            const response = await chai.request(app).post('/users').send(user);
            const body = JSON.parse(response.text);
            expect(body).to.eql({ error: 'Missing email' });
            expect(response.statusCode).to.equal(400);
        });

        it('should fail if user already exists', async function() {
            const user = { email: 'bob@dylan.com', password: 'toto1234!' };
            const response = await chai.request(app).post('/users').send(user);
            const body = JSON.parse(response.text);
            expect(body).to.eql({ error: 'Already exists' });
            expect(response.statusCode).to.equal(400);
        });
    });

    describe('GET /connect', function() {
        it('should fail if no credentials are provided', async function() {
            const response = await chai.request(app).get('/connect').send();
            const body = JSON.parse(response.text);
            expect(body).to.eql({ error: 'Unauthorized' });
            expect(response.statusCode).to.equal(401);
        });

        it('should return a token if credentials are valid', async function() {
            const spyRedisSet = sinon.spy(redisClient.client, 'set');

            const response = await chai.request(app)
                .get('/connect')
                .set('Authorization', credentials)
                .send();
            const body = JSON.parse(response.text);
            token = body.token;
            expect(body).to.have.property('token');
            expect(response.statusCode).to.equal(200);
            expect(spyRedisSet.calledOnceWithExactly(`auth_${token}`, userId, 24 * 3600)).to.be.true;

            spyRedisSet.restore();
        });

        it('should have the token in Redis', async function() {
            const redisToken = await redisClient.client.get(`auth_${token}`);
            expect(redisToken).to.exist;
        });
    });

    describe('GET /disconnect', function() {
        it('should return unauthorized if no token is provided', async function() {
            const response = await chai.request(app).get('/disconnect').send();
            const body = JSON.parse(response.text);
            expect(body).to.eql({ error: 'Unauthorized' });
            expect(response.statusCode).to.equal(401);
        });

        it('should disconnect the user based on the token', async function() {
            const response = await chai.request(app)
                .get('/disconnect')
                .set('X-Token', token)
                .send();
            expect(response.statusCode).to.equal(204);
        });

        it('should no longer have the token in Redis', async function() {
            const redisToken = await redisClient.client.get(`auth_${token}`);
            expect(redisToken).to.not.exist;
        });
    });

    describe('GET /users/me', function() {
        before(async () => {
            const response = await chai.request(app)
                .get('/connect')
                .set('Authorization', credentials)
                .send();
            const body = JSON.parse(response.text);
            token = body.token;
        });

        it('should return unauthorized if no token is provided', async function() {
            const response = await chai.request(app).get('/users/me').send();
            const body = JSON.parse(response.text);
            expect(body).to.eql({ error: 'Unauthorized' });
            expect(response.statusCode).to.equal(401);
        });

        it('should retrieve the user based on the token', async function() {
            const response = await chai.request(app)
                .get('/users/me')
                .set('X-Token', token)
                .send();
            const body = JSON.parse(response.text);
            expect(body).to.eql({ id: userId, email: 'bob@dylan.com' });
            expect(response.statusCode).to.equal(200);
        });
    });
});
