const logger = require('logger');
const ErrorSerializer = require('serializers/errorSerializer');

class GeoStoreValidator {

    static* create(next) {
        logger.debug('Validate create geostore');
        this.checkBody('geojson').optional().isGEOJSON();

        if (this.errors) {
            logger.debug('errors ', this.errors);
            this.body = ErrorSerializer.serializeValidationBodyErrors(this.errors);
            this.status = 400;
            return;
        }
        logger.debug('Validate correct!');
        yield next;
    }

}

module.exports = GeoStoreValidator;
