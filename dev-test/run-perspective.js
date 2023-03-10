var api = new (require('reflective-api'))();
var perspectives = new (require('../lib/perspectives/perspectives'))(api);
var fs = require('fs');

var next = function (error){
    console.error(error);
};

var context = {
    domain: 'thisted'
};

var request = {
    header: function () {
        return JSON.stringify(context);
    }
};

var response = {
    format: function (formats) {
        return formats['default']();
    },
    set: function () {
        
    },
    send: function (data) {
        console.timeEnd('taken');
        fs.writeFileSync('./units.json', JSON.stringify(data, null, '  '));
        //console.log(data);
    }
};
console.time('taken');
return perspectives.units(request, response, next);