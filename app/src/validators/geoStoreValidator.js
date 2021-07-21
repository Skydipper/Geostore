const logger = require('logger');
const ErrorSerializer = require('serializers/errorSerializer');

class GeoStoreValidator {

    static async create(ctx, next) {
        logger.debug('Validate create geostore');
        ctx.checkBody('geojson').optional().isGEOJSON();

        if (ctx.errors) {
            logger.debug('errors ', ctx.errors);
            ctx.body = ErrorSerializer.serializeValidationBodyErrors(ctx.errors);
            ctx.status = 400;
            return;
        }
        logger.debug('Validate correct!');
        await next();
    }

}

module.exports = GeoStoreValidator;
