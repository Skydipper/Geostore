
const logger = require('logger');
const ErrorSerializer = require('serializers/errorSerializer');

class CoverageValidator {

    static* create(next) {
        logger.debug('Validate create coverage');
        this.checkBody('geojson').isGEOJSON();
        this.checkBody('slug').notEmpty();
        this.checkBody('layerSlug').notEmpty();

        if (this.errors) {
            logger.debug('errors ', this.errors);
            this.body = ErrorSerializer.serializeValidationBodyErrors(this.errors);
            this.status = 400;
            return;
        }
        logger.debug('Validate correct!');
        yield next;
    }

    static* update(next) {
        logger.debug('Validate edit coverage');
        this.checkBody('geojson').isGEOJSON();
        this.checkBody('layerSlug').optional().notEmpty();

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

module.exports = CoverageValidator;
