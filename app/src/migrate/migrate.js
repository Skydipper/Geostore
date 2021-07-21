
const config = require('config');
const sleep = require('co-sleep');
const request = require('co-request');
const logger = require('logger');
const co = require('co');
const md5 = require('md5');
const turf = require('turf');
const mongoose = require('mongoose');
const GeoJSONConverter = require('converters/geoJSONConverter');
const geojsonhint = require('geojsonhint');

const uriMigrate = process.env.MIGRATE_URI || config.get('migrate.uri');
const mongoUri = process.env.MONGO_URI || `mongodb://${config.get('mongodb.host')}:${config.get('mongodb.port')}/${config.get('mongodb.database')}`;

const GeoStore = require('models/geoStore');
const IdConnection = require('models/idConnection');

const obtainData = function* (cursor) {
    let url = uriMigrate;
    if (cursor) {
        url += `?cursor=${cursor}`;
    }
    logger.debug('Doing request to ', url);
    let response = yield request({
        url,
        method: 'GET',
        json: true
    });
    if (response.statusCode !== 200) {
        logger.error(response);
        logger.info('Waiting 5 seconds and trying');
        yield sleep(5000);
        response = yield request({
            url,
            method: 'GET',
            json: true
        });
    }
    return response.body;
};

// var completeGeoJSON = function *(el, list) {
//     logger.debug('Complete geojson');
//     let found = null;
//     let numRequest = 0;
//     let firstTime = true;
//     while(!found){
//         for (let i = 0, length = list.length; i < length; i++) {
//             if (list[i] === el.next_id) {
//                 found = list[i];
//                 // if (found.next_id) {
//                 //     found = yield completeGeoJSON(found, list);
//                 // }
//                 el.geojson += found.geojson;
//             }
//         }
//         if (!found) {
//             if(!firstTime){
//                 logger.error('Not found parts');
//                 throw new Error('Not found parts');
//             }
//             firstTime = false;
//             logger.info('Obtaining next data');
//             let data = yield obtainData(nextCursor);
//             nextCursor = data.cursor;
//             list.concatmigrate(data.geostore);
//
//         }
//     }
//     return el;
// }
const checkIfExist = function* (id) {
    const result = yield IdConnection.find({
        oldId: id
    }).exec();
    if (result && result.length > 0) {
        return true;
    }
    return false;
};

const saveData = function* (element) {
    logger.debug('Saving element');
    try {
        logger.debug('Checking if exist id', element.id);
        const exist = yield checkIfExist(element.id);
        if (!exist) {
            const model = yield new GeoStore({
                areaHa: turf.area(element.geojson) / 10000,
                geojson: element.geojson,
                hash: md5(JSON.stringify(element.geojson))
            }).save();

            yield new IdConnection({
                hash: model.hash,
                oldId: element.id
            }).save();
        } else {
            logger.error('Geostore duplicated');
        }
    } catch (e) {
        logger.error(e);
    }
    logger.debug('Saved');
};

const transformAndSaveData = function* (data) {
    logger.debug('Transforming data with data', data);
    const newData = [];
    let geojson; let result; let
        geoData = null;
    const { length } = data;
    for (let i = 0; i < length; i++) {
        logger.debug('Transforming element');
        result = null;
        geoData = data[i];
        if (geoData) {
            try {
                if (data[i].next_id) {
                    logger.debug('Contain next_id');
                    // geoData = yield completeGeoJSON(geoData, data);
                }
                if (geoData.geojson) {
                    logger.debug('checking');
                    geojson = geoData.geojson;
                    logger.debug('Correct JSON');
                    const result = geojsonhint.hint(geojson);
                    if (!result || result.length === 0) {
                        yield saveData({
                            id: geoData.id,
                            geojson: GeoJSONConverter.convert(geojson)
                        });
                    }
                }
            } catch (e) {
                logger.error('JSON not valid', e);
            }
        }

        logger.debug('Percentage %', parseInt((i / length) * 100, 10));
    }
    logger.debug('Finished converting data');
    return newData;
};


const migrate = function* () {
    logger.debug('Connecting to database');
    let data = yield obtainData();

    while (data) {
        logger.debug('Obtained data');

        const element = null;
        let model; const
            idConn = null;
        yield transformAndSaveData(data.geostore);
        if (data.cursor) {
            data = yield obtainData(data.cursor);
        } else {
            data = null;
        }
    }

    logger.debug('Finished migration');
};
const onDbReady = function () {
    co(function* () {
        logger.info('Starting migration');

        yield migrate();
        process.exit();
    });
};
mongoose.connect(mongoUri, onDbReady);
