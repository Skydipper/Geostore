'use strict';

var Router = require('koa-router');
var logger = require('logger');
var GeoStoreValidator = require('validators/geoStoreValidator');
var GeoJSONSerializer = require('serializers/geoJSONSerializer');
var GeoStore = require('models/geoStore');
var IdConnection = require('models/idConnection');
var CartoService = require('services/cartoDBService');
var GeoStoreService = require('services/geoStoreService');
var ProviderNotFound = require('errors/providerNotFound');
var GeoJSONNotFound = require('errors/geoJSONNotFound');

var router = new Router({
    prefix: '/geostore'
});

class GeoStoreRouter {

    static * getGeoStoreById() {
        this.assert(this.params.hash, 400, 'Hash param not found');
        logger.debug('Getting geostore by hash %s', this.params.hash);
        var geoStore = null;

        try {

            geoStore = yield GeoStoreService.getGeostoreById(this.params.hash);

            logger.debug('GeoStore found. Returning...');

            if(!geoStore) {
                this.throw(404, 'GeoStore not found');
                return;
            }
            if(!geoStore.bbox) {
                geoStore = yield GeoStoreService.calculateBBox(geoStore);
            }
            this.body = GeoJSONSerializer.serialize(geoStore);

        } catch(e) {
            logger.error(e);
            throw e;
        }
    }

    static * createGeoStore() {
        logger.info('Saving GeoStore');
        try{
          const data = {
            provider: this.request.body.provider,
            info: {}
          };
          let geostore = yield GeoStoreService.saveGeostore(this.request.body.geojson, data);
          this.body = GeoJSONSerializer.serialize(geostore);
        } catch(err){
            if (err instanceof ProviderNotFound || err instanceof GeoJSONNotFound){
                this.throw(400, err.message);
                return ;
            }
            throw err;
        }
    }

    static * getNational() {
        logger.info('Obtaining national data geojson');
        const data = yield CartoService.getNational(this.params.iso);

        this.body = GeoJSONSerializer.serialize(data);
    }

    static * getSubnational() {
        logger.info('Obtaining subnational data geojson');
        const data = yield CartoService.getSubnational(this.params.iso, this.params.id1);

        this.body = GeoJSONSerializer.serialize(data);
    }

    static * use() {
        logger.info('Obtaining use data with name %s and id %s', this.params.name, this.params.id);
        let useTable = null;
        switch (this.params.name) {
            case 'mining':
                useTable = 'gfw_mining';
                break;
            case 'oilpalm':
                useTable = 'gfw_oil_palm';
                break;
            case 'fiber':
                useTable = 'gfw_wood_fiber';
                break;
            case 'logging':
                useTable = 'gfw_logging';
                break;
            default:
                this.throw(400, 'Name param invalid');
        }
        if (!useTable) {
            this.throw(404, 'Name not found');
        }
        const data = yield CartoService.getUse(useTable, this.params.id);

        this.body = GeoJSONSerializer.serialize(data);
    }

    static * wdpa() {
        logger.info('Obtaining wpda data with id %s', this.params.id);

        const data = yield CartoService.getWdpa(this.params.id);
        this.body = GeoJSONSerializer.serialize(data);
    }
}

router.get('/:hash', GeoStoreRouter.getGeoStoreById);
router.post('/', GeoStoreValidator.create, GeoStoreRouter.createGeoStore);
router.get('/admin/:iso', GeoStoreRouter.getNational);
router.get('/admin/:iso/:id1', GeoStoreRouter.getSubnational);
router.get('/use/:name/:id', GeoStoreRouter.use);
router.get('/wdpa/:id', GeoStoreRouter.wdpa);

module.exports = router;
