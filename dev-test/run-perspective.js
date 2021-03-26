var api = new (require('reflective-api'))();
var perspectives = new (require('../lib/perspectives/perspectives'))(api);
var next = function (){};

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
        //console.log(data);
    }
};
console.time('taken');
return perspectives.units(request, response, next);