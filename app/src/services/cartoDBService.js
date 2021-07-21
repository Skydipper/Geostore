const logger = require('logger');
const config = require('config');
const CartoDB = require('cartodb');
const Mustache = require('mustache');
const GeoStoreService = require('services/geoStoreService');

const ISO = `SELECT ST_AsGeoJSON(st_makevalid(the_geom)) AS geojson, (ST_Area(geography(the_geom))/10000) as area_ha, name_0 as name
        FROM gadm2_countries_simple
        WHERE iso = UPPER('{{iso}}')`;

const ISO_NAME = `SELECT iso, name_0 as name
        FROM gadm2_countries_simple
        WHERE iso in `;

const ID1 = `SELECT ST_AsGeoJSON(st_makevalid(the_geom)) AS geojson, (ST_Area(geography(the_geom))/10000) as area_ha
        FROM gadm28_adm1
        WHERE iso = UPPER('{{iso}}')
          AND id_1 = {{id1}}`;

const ID2 = `SELECT ST_AsGeoJSON(st_makevalid(the_geom)) AS geojson, (ST_Area(geography(the_geom))/10000) as area_ha
        FROM gadm28_adm2_geostore
        WHERE iso = UPPER('{{iso}}')
          AND id_1 = {{id1}}
          AND id_2 = {{id2}}`;

const WDPA = `SELECT ST_AsGeoJSON(st_makevalid(p.the_geom)) AS geojson, (ST_Area(geography(the_geom))/10000) as area_ha
        FROM (
          SELECT CASE
          WHEN marine::numeric = 2 THEN NULL
            WHEN ST_NPoints(the_geom)<=18000 THEN the_geom
            WHEN ST_NPoints(the_geom) BETWEEN 18000 AND 50000 THEN ST_RemoveRepeatedPoints(the_geom, 0.001)
            ELSE ST_RemoveRepeatedPoints(the_geom, 0.005)
            END AS the_geom
          FROM wdpa_protected_areas
          WHERE wdpaid={{wdpaid}}
        ) p`;

const USE = `SELECT ST_AsGeoJSON(st_makevalid(the_geom)) AS geojson, (ST_Area(geography(the_geom))/10000) as area_ha
        FROM {{use}}
        WHERE cartodb_id = {{id}}`;

const executeThunk = (client, sql, params) => new Promise(((resolve, reject) => {
    logger.debug(Mustache.render(sql, params));
    client.execute(sql, params).done((data) => {
        resolve(data);
    }).error((err) => {
        reject(err);
    });
}));

class CartoDBService {

    constructor() {
        this.client = new CartoDB.SQL({
            user: config.get('cartoDB.user')
        });
    }

    async getNational(iso) {
        logger.debug('Obtaining national of iso %s', iso);
        const params = {
            iso: iso.toUpperCase(),
            id1: null,
            id2: null,
            gadm: '2.8'
        };
        logger.debug('Checking existing national geo');
        let existingGeo = await GeoStoreService.getGeostoreByInfo(params);
        logger.debug('Existed geo', existingGeo);
        if (existingGeo) {
            logger.debug('Return national geojson stored');
            return existingGeo;
        }

        logger.debug('Request national to carto');
        const data = await executeThunk(this.client, ISO, { iso: iso.toUpperCase() });
        if (data.rows && data.rows.length > 0) {
            const result = data.rows[0];
            logger.debug('Saving national geostore');
            const geoData = {
                info: params
            };
            geoData.info.name = result.name;
            existingGeo = await GeoStoreService.saveGeostore(JSON.parse(result.geojson), geoData);
            logger.debug('Return national geojson from carto');
            return existingGeo;
        }
        return null;
    }

    async getNationalList() {
        logger.debug('Request national list names from carto');
        const countryList = await GeoStoreService.getNationalList();
        const isoMapValues = countryList.map((el) => el.info.iso);
        let isoValues = '';
        isoMapValues.forEach((el) => {
            isoValues += `'${el.toUpperCase()}', `;
        });
        isoValues = `(${isoValues.substr(0, isoValues.length - 2)})`;
        const data = await executeThunk(this.client, ISO_NAME + isoValues);
        if (data.rows && data.rows.length > 0) {
            logger.debug('Adding Country names');
            countryList.forEach((countryListElement) => {
                const idx = data.rows.findIndex((el) => el.iso.toUpperCase() === countryListElement.info.iso.toUpperCase());
                if (idx > -1) {
                    countryListElement.name = data.rows[idx].name;
                    data.rows.splice(idx, 1);
                    logger.debug(data.rows);
                }
            });
        }
        return countryList;
    }

    async getSubnational(iso, id1) {
        logger.debug('Obtaining subnational of iso %s and id1', iso, id1);
        const params = {
            iso: iso.toUpperCase(),
            id1: parseInt(id1, 10),
            id2: null,
            gadm: '2.8'
        };

        logger.debug('Checking existing subnational geo');
        let existingGeo = await GeoStoreService.getGeostoreByInfo(params);
        logger.debug('Existed geo', existingGeo);
        if (existingGeo) {
            logger.debug('Return subnational geojson stored');
            return existingGeo;
        }

        logger.debug('Request subnational to carto');
        const data = await executeThunk(this.client, ID1, params);
        if (data.rows && data.rows.length > 0) {
            logger.debug('Return subnational geojson from carto');
            const result = data.rows[0];
            logger.debug('Saving national geostore');
            const geoData = {
                info: params
            };
            existingGeo = await GeoStoreService.saveGeostore(JSON.parse(result.geojson), geoData);
            return existingGeo;
        }
        return null;
    }

    async getAdmin2(iso, id1, id2) {
        logger.debug('Obtaining admin2 of iso %s, id1 and id2', iso, id1, id2);
        const params = {
            iso: iso.toUpperCase(),
            id1: parseInt(id1, 10),
            id2: parseInt(id2, 10),
            gadm: '2.8'
        };

        logger.debug('Checking existing admin2 geostore');
        let existingGeo = await GeoStoreService.getGeostoreByInfo(params);
        logger.debug('Existed geo', existingGeo);
        if (existingGeo) {
            logger.debug('Return admin2 geojson stored');
            return existingGeo;
        }

        logger.debug('Request admin2 shape from Carto');
        const data = await executeThunk(this.client, ID2, params);
        if (data.rows && data.rows.length > 0) {
            logger.debug('Return admin2 geojson from Carto');
            const result = data.rows[0];
            logger.debug('Saving admin2 geostore');
            const geoData = {
                info: params
            };
            existingGeo = await GeoStoreService.saveGeostore(JSON.parse(result.geojson), geoData);
            return existingGeo;
        }
        return null;
    }

    async getUse(use, id) {
        logger.debug('Obtaining use with id %s', id);

        const params = {
            use,
            id: parseInt(id, 10)
        };
        const info = {
            use: params
        };

        logger.debug('Checking existing use geo', info);
        let existingGeo = await GeoStoreService.getGeostoreByInfo(info);
        logger.debug('Existed geo', existingGeo);
        if (existingGeo) {
            logger.debug('Return use geojson stored');
            return existingGeo;
        }

        logger.debug('Request use to carto');
        const data = await executeThunk(this.client, USE, params);

        if (data.rows && data.rows.length > 0) {
            const result = data.rows[0];
            logger.debug('Saving use geostore');
            const geoData = {
                info
            };
            existingGeo = await GeoStoreService.saveGeostore(JSON.parse(result.geojson), geoData);
            logger.debug('Return use geojson from carto');
            return existingGeo;
        }
        return null;
    }

    async getWdpa(wdpaid) {
        logger.debug('Obtaining wpda of id %s', wdpaid);

        const params = {
            wdpaid: parseInt(wdpaid, 10)
        };

        logger.debug('Checking existing wdpa geo');
        let existingGeo = await GeoStoreService.getGeostoreByInfo(params);
        logger.debug('Existed geo', existingGeo);
        if (existingGeo) {
            logger.debug('Return wdpa geojson stored');
            return existingGeo;
        }

        logger.debug('Request wdpa to carto');
        const data = await executeThunk(this.client, WDPA, params);
        if (data.rows && data.rows.length > 0) {
            const result = data.rows[0];
            logger.debug('Saving national geostore');
            const geoData = {
                info: params
            };
            existingGeo = await GeoStoreService.saveGeostore(JSON.parse(result.geojson), geoData);
            logger.debug('Return wdpa geojson from carto');
            return existingGeo;
        }
        return null;
    }

}

module.exports = new CartoDBService();
