
const Router = require('koa-router');
const logger = require('logger');
const CoverageSerializer = require('serializers/coverageSerializer');
const CoverageValidator = require('validators/coverageValidator');
const GeoStore = require('models/geoStore');
const IdConnection = require('models/idConnection');
const CoverageService = require('services/coverageService');
const GeoStoreService = require('services/geoStoreService');
const CoverageDuplicated = require('errors/coverageDuplicated');
const CoverageNotFound = require('errors/coverageNotFound');
const GeoJSONNotFound = require('errors/geoJSONNotFound');

const router = new Router({
    prefix: '/coverage'
});


class CoverageRouter {

    static* intersectUse() {
        logger.info(`Calculating intersect with use ${this.params.name} and id ${this.params.id}`);
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
        const result = yield CoverageService.getUse(useTable, this.params.id);
        this.body = CoverageSerializer.serialize({
            layers: result
        });
    }

    static* intersectIsoRegion() {
        logger.info(`Calculating intersect with iso ${this.params.iso} and region ${this.params.id1}`);
        let result = null;
        if (!this.params.id1) {
            result = yield CoverageService.getNational(this.params.iso);
        } else {
            result = yield CoverageService.getSubnational(this.params.iso, this.params.id1);
        }
        this.body = CoverageSerializer.serialize({
            layers: result
        });
    }

    static* intersectWdpa() {
        logger.info(`Calculating intersect with wdpa ${this.params.id}`);
        const result = yield CoverageService.getWdpa(this.params.id);

        this.body = CoverageSerializer.serialize({
            layers: result
        });

    }

    static* intersectGeo() {
        logger.info(`Calculating intersect with geostore ${this.query.geostore}`);
        this.assert(this.query.geostore, 400, 'GeoJSON param required');
        const geoStore = yield GeoStoreService.getGeostoreById(this.query.geostore);


        if (!geoStore || !geoStore.geojson) {
            this.throw(404, 'Use not found');
        }
        const options = {
            slugs: this.query.slugs && this.query.slugs.split(',')
        };
        const result = yield CoverageService.getWorld(geoStore.geojson.features[0].geometry, options);
        this.body = CoverageSerializer.serialize({
            layers: result
        });
    }

}

router.get('/intersect', CoverageRouter.intersectGeo);
router.get('/intersect/admin/:iso', CoverageRouter.intersectIsoRegion);
router.get('/intersect/admin/:iso/:id1', CoverageRouter.intersectIsoRegion);
router.get('/intersect/use/:name/:id', CoverageRouter.intersectUse);
router.get('/intersect/wdpa/:id', CoverageRouter.intersectWdpa);

module.exports = router;
