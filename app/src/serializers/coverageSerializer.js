const JSONAPISerializer = require('jsonapi-serializer').Serializer;

const coverageSerializer = new JSONAPISerializer('coverages', {
    attributes: ['layers'],
    typeForAttribute(attribute) {
        return attribute;
    },
    keyForAttribute: 'camelCase'
});

class CoverageSerializer {

    static serialize(data) {
        return coverageSerializer.serialize(data);
    }

}

module.exports = CoverageSerializer;
