const config = require('config');
const logger = require('logger');
const koa = require('koa');
const bodyParser = require('koa-bodyparser');
const koaLogger = require('koa-logger');
const loader = require('loader');
const validate = require('koa-validate');
const mongoose = require('mongoose');
const ErrorSerializer = require('serializers/errorSerializer');

const mongoUri = process.env.MONGO_URI || `mongodb://${config.get('mongodb.host')}:${config.get('mongodb.port')}/${config.get('mongodb.database')}`;
const ctRegisterMicroservice = require('ct-register-microservice-node');
const sleep = require('sleep');

// const nock = require('nock');
// nock.recorder.rec();

let retries = 10;

async function init() {
    return new Promise((resolve, reject) => {
        async function onDbReady(err) {
            if (err) {
                if (retries >= 0) {
                    retries--;
                    logger.error(`Failed to connect to MongoDB uri ${mongoUri}, retrying...`);
                    sleep.sleep(5);
                    mongoose.connect(mongoUri, onDbReady);
                } else {
                    logger.error('MongoURI', mongoUri);
                    logger.error(err);
                    reject(new Error(err));
                }

                return;
            }

            // instance of koa
            const app = koa();

            // if environment is dev then load koa-logger
            if (process.env.NODE_ENV === 'dev') {
                app.use(koaLogger());
            }

            app.use(bodyParser({
                jsonLimit: '50mb'
            }));

            // catch errors and send in jsonapi standard. Always return vnd.api+json
            app.use(function* (next) {
                try {
                    yield next;
                } catch (err) {
                    this.status = err.status || 500;
                    if (this.status >= 500) {
                        logger.error(err);
                    } else {
                        logger.info(err);
                    }

                    this.body = ErrorSerializer.serializeError(this.status, err.message || err);
                    logger.debug(this.body);
                    if (process.env.NODE_ENV === 'prod' && this.status === 500) {
                        this.body = 'Unexpected error';
                    }
                }
                this.response.type = 'application/vnd.api+json';
            });

            // load custom validator
            require('validators/geoJSONValidator');
            app.use(validate());

            // load routes
            loader.loadRoutes(app);

            // Instance of http module
            // const app = require('http').Server(app.callback());


            // get port of environment, if not exist obtain of the config.
            // In production environment, the port must be declared in environment variable
            const port = process.env.PORT || config.get('service.port');

            const server = app.listen(port, () => {
                ctRegisterMicroservice.register({
                    info: require('../microservice/register.json'),
                    swagger: require('../microservice/public-swagger.json'),
                    mode: (process.env.CT_REGISTER_MODE && process.env.CT_REGISTER_MODE === 'auto') ? ctRegisterMicroservice.MODE_AUTOREGISTER : ctRegisterMicroservice.MODE_NORMAL,
                    framework: ctRegisterMicroservice.KOA1,
                    app,
                    logger,
                    name: config.get('service.name'),
                    ctUrl: process.env.CT_URL,
                    url: process.env.LOCAL_URL,
                    active: true,
                }).then(() => {
                    logger.info('Server started in ', process.env.PORT);
                    resolve({ app, server });
                }, (err) => {
                    logger.error(err);
                    process.exit(1);
                });
            });

            logger.info(`Server started in port:${port}`);

        }


        logger.info(`Connecting to MongoDB URL ${mongoUri}`);

        let dbOptions = {};
        if (mongoUri.indexOf('replicaSet') > -1) {
            dbOptions = {
                db: { native_parser: true },
                replset: {
                    auto_reconnect: false,
                    poolSize: 10,
                    socketOptions: {
                        keepAlive: 1000,
                        connectTimeoutMS: 30000
                    }
                },
                server: {
                    poolSize: 5,
                    socketOptions: {
                        keepAlive: 1000,
                        connectTimeoutMS: 30000
                    }
                }
            };
        }
        mongoose.connect(mongoUri, dbOptions, onDbReady);


    });
}

module.exports = init;
