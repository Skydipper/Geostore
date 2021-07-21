/* eslint-disable no-unused-vars,no-undef */
const nock = require('nock');
const chai = require('chai');
const config = require('config');
const GeoStore = require('models/geoStore');
const fs = require('fs');
const path = require('path');

const {
    getTestServer
} = require('../utils/test-server');

const should = chai.should();

let requester;
nock.disableNetConnect();
nock.enableNetConnect(process.env.HOST_IP);

describe('Geostore v2 tests - Get geostore - National level', () => {

    before(async () => {
        if (process.env.NODE_ENV !== 'test') {
            throw Error(`Running the test suite with NODE_ENV ${process.env.NODE_ENV} may result in permanent data loss. Please use NODE_ENV=test.`);
        }
        if (config.get('cartoDB.user') === null) {
            throw Error(`Carto user not set - please specify a CARTODB_USER env var with it.`);
        }

        requester = await getTestServer();

        GeoStore.remove({}).exec();

        nock.cleanAll();
    });

    it('Get country that doesn\'t exist should return a 404', async () => {
        nock(`https://${process.env.CARTODB_USER}.cartodb.com`)
            .get('/api/v2/sql')
            .query({
                q: 'SELECT ST_AsGeoJSON(ST_MAKEVALID(ST_Simplify(the_geom, 0.005))) AS geojson, area_ha, name_0 as name\n        FROM gadm36_countries\n        WHERE gid_0 = UPPER(\'AAA\')'
            })
            .reply(200, {
                rows: [],
                time: 0.349,
                fields: {
                    geojson: {
                        type: 'string'
                    },
                    area_ha: {
                        type: 'number'
                    },
                    name: {
                        type: 'string'
                    }
                },
                total_rows: 0
            });


        const response = await requester.get(`/api/v2/geostore/admin/AAA`).send();

        response.status.should.equal(404);
        response.body.should.have.property('errors').and.be.an('array');
        response.body.errors[0].should.have.property('status').and.equal(404);
        response.body.errors[0].should.have.property('detail').and.equal('Country not found');
    });

    it('Get country that exists should return a 200', async () => {
        nock(`https://${process.env.CARTODB_USER}.cartodb.com`)
            .get('/api/v2/sql')
            .query({
                q: 'SELECT ST_AsGeoJSON(ST_MAKEVALID(ST_Simplify(the_geom, 0.005))) AS geojson, area_ha, name_0 as name\n        FROM gadm36_countries\n        WHERE gid_0 = UPPER(\'MCO\')'
            })
            .reply(200, {
                rows: [{
                    geojson: '{"type":"MultiPolygon","coordinates":[[[[7.4134,43.7346],[7.4396,43.7492],[7.4179,43.7226],[7.4095,43.7299],[7.4134,43.7346]]]]}',
                    area_ha: 235.490994944,
                    name: 'Monaco'
                }],
                time: 0.002,
                fields: {
                    geojson: {
                        type: 'string'
                    },
                    area_ha: {
                        type: 'number'
                    },
                    name: {
                        type: 'string'
                    }
                },
                total_rows: 1
            });


        const response = await requester.get(`/api/v2/geostore/admin/MCO?simplify=0.005`).send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        response.body.data.should.have.property('type').and.equal('geoStore');
        response.body.data.should.have.property('id').and.a('string');
        response.body.data.should.have.property('attributes').and.be.an('object');

        response.body.data.attributes.should.have.property('areaHa').and.equal(200.60179285554386);
        response.body.data.attributes.should.have.property('bbox').and.be.an('array');
        response.body.data.attributes.should.have.property('geojson').and.be.an('object');
        response.body.data.attributes.should.have.property('hash').and.be.a('string');
        response.body.data.attributes.should.have.property('info').and.be.an('object');

        response.body.data.attributes.info.should.have.property('gadm').and.equal('3.6');
        response.body.data.attributes.info.should.have.property('iso').and.equal('MCO');
        response.body.data.attributes.info.should.have.property('simplifyThresh').and.equal(0.005);
        response.body.data.attributes.info.should.have.property('name');
    });

    it('Get country that has been saved to the local database should return a 200', async () => {
        const response = await requester.get(`/api/v2/geostore/admin/MCO?simplify=0.005`).send();

        response.status.should.equal(200);
        response.body.should.have.property('data').and.be.an('object');
        response.body.data.should.have.property('type').and.equal('geoStore');
        response.body.data.should.have.property('id').and.a('string');
        response.body.data.should.have.property('attributes').and.be.an('object');

        response.body.data.attributes.should.have.property('areaHa').and.equal(200.60179285554386);
        response.body.data.attributes.should.have.property('bbox').and.be.an('array');
        response.body.data.attributes.should.have.property('geojson').and.be.an('object');
        response.body.data.attributes.should.have.property('hash').and.be.a('string');
        response.body.data.attributes.should.have.property('info').and.be.an('object');

        response.body.data.attributes.info.should.have.property('gadm').and.equal('3.6');
        response.body.data.attributes.info.should.have.property('iso').and.equal('MCO');
        response.body.data.attributes.info.should.have.property('simplifyThresh').and.equal(0.005);
        response.body.data.attributes.info.should.have.property('name');
    });

    it('Get complex country that exists should return a 200', async () => {

        nock(`https://${process.env.CARTODB_USER}.cartodb.com`, {
            encodedQueryParams: true
        })
            .get('/api/v2/sql')
            .query({
                q: 'SELECT ST_AsGeoJSON(ST_MAKEVALID(ST_Simplify(the_geom, 0.005))) AS geojson, area_ha, name_0 as name\n        FROM gadm36_countries\n        WHERE gid_0 = UPPER(\'USA\')'
            })
            .reply(200, JSON.parse(fs.readFileSync(path.join(__dirname, 'resources', 'USA-request-one-reply.json'))), ['Server',
                'openresty',
                'Date',
                'Thu, 14 Mar 2019 07:16:04 GMT',
                'Content-Type',
                'application/json; charset=utf-8',
                'Content-Length',
                '1091031',
                'Connection',
                'close',
                'Vary',
                'Accept-Encoding',
                'Vary',
                'Accept-Encoding',
                'Access-Control-Allow-Origin',
                '*',
                'Access-Control-Allow-Headers',
                'X-Requested-With, X-Prototype-Version, X-CSRF-Token, Authorization',
                'vary',
                'Authorization',
                'X-SQLAPI-Log',
                '{"request":{"sql":{"type":"query","sql":"SELECT ST AsGeoJSON ST Simplify the geom  0 005   AS geojson  area ha  name 0 as name         FROM gadm36 countries         WHERE gid 0   UPPER  USA  "}}}',
                'Content-Disposition',
                'inline; filename=cartodb-query.json; modification-date="Thu, 14 Mar 2019 07:07:41 GMT";',
                'Cache-Control',
                'no-cache,max-age=31536000,must-revalidate,public',
                'Surrogate-Key',
                't:gCSLeN',
                'Last-Modified',
                'Wed, 17 Oct 2018 15:52:41 GMT',
                'X-SQLAPI-Profiler',
                '{"authorization":8,"getConnectionParams":4,"getUserTimeoutLimits":1,"queryExplain":11,"beforeSink":914,"total":938}',
                'X-Varnish',
                '819430099 837648736',
                'Age',
                '502',
                'X-Cache',
                'HIT',
                'Accept-Ranges',
                'bytes'
            ]);

        const response = await requester.get(`/api/v2/geostore/admin/USA?simplify=0.005`).send();

        response.status.should.equal(200);
    });

    afterEach(() => {
        if (!nock.isDone()) {
            throw new Error(`Not all nock interceptors were used: ${nock.pendingMocks()}`);
        }
    });

    after(() => {
        GeoStore.remove({}).exec();
    });
});
