
const logger = require('logger');
const CoverageDuplicated = require('errors/coverageDuplicated');
const CoverageNotFound = require('errors/coverageNotFound');
const CartoDB = require('cartodb');
const Mustache = require('mustache');
const config = require('config');

const ISO = `with c as (select the_geom_webmercator, st_area(the_geom_webmercator)/10000 as area_ha from gadm36_adm0 where iso = UPPER('{{iso}}')),
            cl as (select (st_buffer(st_simplify(the_geom_webmercator,10000),1)) the_geom_webmercator, slug, coverage_slug from coverage_layers)
            SELECT slug FROM  cl inner join c on ST_INTERSECTS(c.the_geom_webmercator, cl.the_geom_webmercator)
            where (((st_area(ST_intersection(c.the_geom_webmercator, cl.the_geom_webmercator))/10000)::numeric/area_ha::numeric)*100)>1`;

const ID1 = `with c as (select the_geom_webmercator, st_area(the_geom_webmercator)/10000 as area_ha from gadm36_adm1 where iso = UPPER('{{iso}}') AND id_1 = {{id1}}),
            cl as (select (st_buffer(st_simplify(the_geom_webmercator,10000),1)) the_geom_webmercator, slug, coverage_slug from coverage_layers)
            SELECT slug FROM  cl inner join c on ST_INTERSECTS(c.the_geom_webmercator, cl.the_geom_webmercator)
            where (((st_area(ST_intersection(c.the_geom_webmercator, cl.the_geom_webmercator))/10000)::numeric/area_ha::numeric)*100)>1`;

const WDPA = `with p as (SELECT p.the_geom AS the_geom
        FROM (
          SELECT CASE
          WHEN marine::numeric = 2 THEN NULL
            WHEN ST_NPoints(the_geom)<=18000 THEN the_geom
            WHEN ST_NPoints(the_geom) BETWEEN 18000 AND 50000 THEN ST_RemoveRepeatedPoints(the_geom, 0.001)
            ELSE ST_RemoveRepeatedPoints(the_geom, 0.005)
            END AS the_geom
          FROM wdpa_protected_areas
          WHERE wdpaid={{wdpaid}}
      ) p)
        SELECT slug from coverage_layers cl, p where ST_INTERSECTS(cl.the_geom, p.the_geom) `;

const USE = `SELECT slug FROM coverage_layers cl, {{useTable}} c where c.cartodb_id = {{pid}} and ST_INTERSECTS(cl.the_geom, c.the_geom)`;


const COVERAGES = `SELECT ST_AsGeoJSON(the_geom) as geojson, coverage_slug as slug, slug as layerSlug from coverage_layers`;

const WORLD = `SELECT slug FROM coverage_layers where ST_INTERSECTS(the_geom, ST_SetSRID(ST_GeomFromGeoJSON('{{{geojson}}}'), 4326))`;
const REDUCED_WORLD = `with p as (SELECT slug, the_geom FROM coverage_layers {{{filter}}}) SELECT slug FROM p  where ST_INTERSECTS(the_geom, ST_SetSRID(ST_GeomFromGeoJSON('{{{geojson}}}'), 4326))`;


const executeThunk = function (client, sql, params) {
    return function (callback) {
        client.execute(sql, params).done((data) => {
            callback(null, data);
        }).error((err) => {
            callback(err[0], null);
        });
    };
};


class CoverageServiceV2 {

    constructor() {
        this.client = new CartoDB.SQL({
            user: config.get('cartoDB.user')
        });
    }

    * getNational(iso) {
        logger.debug('Obtaining national of iso %s', iso);
        const params = {
            iso
        };

        const data = yield executeThunk(this.client, ISO, params);
        if (data.rows && data.rows.length > 0) {
            return data.rows.map((item) => item.slug);
        }
        return [];
    }

    * getSubnational(iso, id1) {
        logger.debug('Obtaining subnational of iso %s and id1', iso, id1);
        const params = {
            iso,
            id1
        };

        const data = yield executeThunk(this.client, ID1, params);
        if (data.rows && data.rows.length > 0) {
            return data.rows.map((item) => item.slug);
        }
        return [];
    }

    * getUse(useTable, id) {
        logger.debug('Obtaining use with id %s', id);

        const params = {
            useTable,
            pid: id
        };

        const data = yield executeThunk(this.client, USE, params);

        if (data.rows && data.rows.length > 0) {
            return data.rows.map((item) => item.slug);
        }
        return [];
    }

    * getWdpa(wdpaid) {
        logger.debug('Obtaining wpda of id %s', wdpaid);

        const params = {
            wdpaid
        };

        const data = yield executeThunk(this.client, WDPA, params);
        if (data.rows && data.rows.length > 0) {
            return data.rows.map((item) => item.slug);
        }
        return [];
    }

    * getCoverages() {
        logger.info('Getting coverages');

        const data = yield executeThunk(this.client, COVERAGES);
        return data;
    }

    * getWorld(geojson, { slugs }) {
        logger.info('Getting layers that intersect');

        const params = {
            geojson: JSON.stringify(geojson),
            filter: slugs && slugs.length && `WHERE slug IN (${slugs.map((slug) => `'${slug.trim()}'`).join(',')})`
        };
        const query = slugs ? REDUCED_WORLD : WORLD;
        const data = yield executeThunk(this.client, query, params);
        if (data.rows && data.rows.length > 0) {
            return data.rows.map((item) => item.slug);
        }
        return [];
    }

}

module.exports = new CoverageServiceV2();
