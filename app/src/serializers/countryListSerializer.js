class CountryListSerializer {

    static serialize(data) {
        return {
            data: data.map((el) => ({
                geostoreId: el.hash,
                iso: el.info.iso,
                name: el.name
            }))
        };
    }

}

module.exports = CountryListSerializer;
