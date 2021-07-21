const JSONAPISerializer = require('jsonapi-serializer').Serializer;

const geoStoreSerializer = new JSONAPISerializer('geoStore', {
    attributes: ['geojson', 'hash', 'provider', 'areaHa', 'bbox', 'lock', 'esrijson', 'info'],
    id: 'hash',

    geojson: {
        attributes: ['type', 'features', 'crs']
    },
    esrijson: {
        attributes: ['rings', 'spatialReference']
    },
    provider: {
        attributes: ['type', 'table', 'user', 'filter']
    },
    typeForAttribute(attribute) {
        return attribute;
    },
    keyForAttribute: 'camelCase'
});

class GeoStoreSerializer {

    static serialize(data) {
        return geoStoreSerializer.serialize(data);
    }

}

module.exports = GeoStoreSerializer;
