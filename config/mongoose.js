const config = require('config');

const mongooseOptions = {
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
    useUnifiedTopology: (config.get('mongodb.useUnifiedTopology') === 'true'),
    readPreference: 'secondaryPreferred', // Has MongoDB prefer secondary servers for read operations.
    appname: 'geostore', // Displays the app name in MongoDB logs, for ease of debug
    serverSelectionTimeoutMS: 5000, // Number of milliseconds the underlying MongoDB driver has to pick a server
    poolSize: 10 // Default is 5, setting to 10 to prevent slower queries from blocking things
};

module.exports = mongooseOptions;
