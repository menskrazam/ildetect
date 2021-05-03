const yopta = require('./core');

module.exports = function (source) {
    return yopta.compile(source, 'ys');
}
