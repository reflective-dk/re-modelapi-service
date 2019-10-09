"use strict";

var _ = require('lodash');
var Promise = require('bluebird');
var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;

var Perspectives = require('../lib/perspectives/perspectives');
var util = require('../lib/util');
var models = require('re-models').model;
var csvjson = require('csvjson');

var context = { domain: 'thisted' };
var request = { header: function() { return JSON.stringify(context); } };
var next = console.log;

describe('Perspectives', function() {
    before(_before);

    describe('units', function() {
        var expected = [
            { Id: 'id-50128',
	      EksterntId: '50128',
	      Navn: 'Plaf',
	      OverordnetId: '',
	      OverordnetEksterntId: '',
	      OverordnetNavn: '',
	      KortNavn: 'PLAF',
              StiFraRod: 'Plaf',
	      EnhedstypeId: 'afdeling',
	      EnhedstypeEksterntId: '22',
	      EnhedstypeNavn: 'Afdeling',
	      Telefon: '23456789',
	      'Email thisted.dk': 'plaf@thisted.dk',
	      SENummer: '77777777',
	      EanNummer: '0123456789012',
	      Omkostningssteder: '4444',
	      Adresse: 'Skolegade 15',
	      Postnummer: '7700',
	      By: 'Thisted',
	      Land: 'Danmark',
	      AktivFra: '01-01-2010',
	      AktivTil: '' },
            { Id: 'id-50150',
	      EksterntId: '50150',
	      Navn: 'Plif',
	      OverordnetId: 'id-50128',
	      OverordnetEksterntId: '50128',
	      OverordnetNavn: 'Plaf',
              StiFraRod: 'Plaf < Plif',
	      KortNavn: 'PLIF',
	      EnhedstypeId: 'sektion',
	      EnhedstypeEksterntId: '23',
	      EnhedstypeNavn: 'Sektion',
	      Telefon: '23456789',
	      'Email thisted.dk': 'plif@thisted.dk',
	      SENummer: '77777777',
	      EanNummer: '0123456789012',
	      Omkostningssteder: '3333',
	      Adresse: 'Skolegade 20',
	      Postnummer: '7700',
	      By: 'Thisted',
	      Land: 'Danmark',
	      AktivFra: '',
	      AktivTil: '' }
        ];

        it('should return expected result', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.units(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers.default();
                    }
                }, next);
            })).to.eventually.deep.equal({
                status: 200,
                body: expected.map(o => removeBlanks(o))
            }).notify(done);
        });

        it('should return convert to CSV if requested', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.units(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers['text/csv']();
                    }
                }, next);
            }).then(function(response) {
                return csvjson.toObject(response.body, {
                    delimiter: ';', quote: '"'
                });
            })).to.eventually.deep.equal(expected).notify(done);
        });
    });

    describe('employees', function() {
        var expected = [
            { Id: 'ansaettelse2',
	      EksterntId: '36, 0036',
	      Medarbejdernummer: '0036',
	      Navn: 'Svend Svendsen',
	      EnhedId: 'id-50128',
	      EnhedEksterntId: '50128',
	      EnhedNavn: 'Plaf',
              StiFraRod: 'Plaf',
              'Bruger System 1': 'kai',
              CprNummer: '0303030303',
              Telefon: '23232323',
              'Email thisted.dk': 'someone@thisted.dk',
              StillingEksterntId: '12',
              StillingId: 'teamleder',
              StillingNavn: 'Teamleder',
              StillingKortNavn: 'TMLED',
	      AktivFra: '',
	      AktivTil: '' },
            { Id: 'ansaettelse',
	      EksterntId: '35, 0035',
	      Medarbejdernummer: '0035',
	      Navn: 'Lars Larsen',
	      EnhedId: 'id-50150',
	      EnhedEksterntId: '50150',
	      EnhedNavn: 'Plif',
              StiFraRod: 'Plaf < Plif',
              'Bruger System 1': 'vai',
              CprNummer: '0101010101',
              Telefon: '23232323',
              'Email thisted.dk': 'someone@thisted.dk',
              StillingEksterntId: '11',
              StillingId: 'sektionsleder',
              StillingNavn: 'Sektionsleder',
              StillingKortNavn: 'SEKLED',
	      AktivFra: '',
	      AktivTil: '' }
        ];

        it('should return expected result', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.employees(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers.default();
                    }
                }, next);
            })).to.eventually.deep.equal({
                status: 200,
                body: expected.map(o => removeBlanks(o))
            }).notify(done);
        });

        it('should return convert to CSV if requested', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.employees(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers['text/csv']();
                    }
                }, next);
            }).then(function(response) {
                return csvjson.toObject(response.body, {
                    delimiter: ';', quote: '"'
                });
            })).to.eventually.deep.equal(expected).notify(done);
        });
    });

    describe('roleAssignments', function() {
        var expected = [
            { Id: 'ledertildeling',
              MedarbejderId: 'ansaettelse',
              MedarbejderEksterntId: '35, 0035',
              MedarbejderNavn: 'Lars Larsen',
	      EnhedId: 'id-50128',
	      EnhedEksterntId: '50128',
	      EnhedNavn: 'Plaf',
              StiFraRod: 'Plaf',
              RolleId: 'leder',
              RolleEksterntId: '8',
              RolleNavn: 'Leder',
              'Bruger System 1': 'vai',
              Telefon: '23232323',
              'Email thisted.dk': 'someone@thisted.dk',
              Ansvar: 'Foo Responsibility, Bar Responsibility',
	      AktivFra: '',
	      AktivTil: '' },
            { Id: 'altmuligmandtildeling',
              MedarbejderId: 'ansaettelse2',
              MedarbejderEksterntId: '36, 0036',
              MedarbejderNavn: 'Svend Svendsen',
	      EnhedId: 'id-50150',
	      EnhedEksterntId: '50150',
	      EnhedNavn: 'Plif',
              RolleId: 'altmuligmand',
              RolleEksterntId: '9',
              RolleNavn: 'Altmuligmand',
              StiFraRod: 'Plaf < Plif',
              'Bruger System 1': 'kai',
              Telefon: '23232323',
              'Email thisted.dk': 'someone@thisted.dk',
              Ansvar: 'Foo Responsibility, Bar Responsibility',
	      AktivFra: '',
	      AktivTil: '' }
        ];

        it('should return expected result', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.roleAssignments(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers.default();
                    }
                }, next);
            })).to.eventually.deep.equal({
                status: 200,
                body: expected.map(o => removeBlanks(o))
            }).notify(done);
        });

        it('should return convert to CSV if requested', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.roleAssignments(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers['text/csv']();
                    }
                }, next);
            }).then(function(response) {
                return csvjson.toObject(response.body, {
                    delimiter: ';', quote: '"'
                });
            })).to.eventually.deep.equal(expected).notify(done);
        });
    });

    describe('userAccounts', function() {
        var expected = [
            { Id: 'user-account2',
              EksterntId: '1002, 3002',
              Navn: 'kai',
              MedarbejderId: 'ansaettelse2',
              MedarbejderEksterntId: '36, 0036',
              MedarbejderNavn: 'Svend Svendsen',
	      EnhedId: 'id-50128',
	      EnhedEksterntId: '50128',
	      EnhedNavn: 'Plaf',
              StiFraRod: 'Plaf',
              Brugernavn: 'kai',
              'Email thisted.dk': 'someone@thisted.dk',
              Systemer: 'System 1',
              HomeDirectory: '',
              HomeDrive: '',
	      AktivFra: '',
	      AktivTil: '' },
            { Id: 'user-account',
              EksterntId: '1001, 3001',
              Navn: 'vai',
              MedarbejderId: 'ansaettelse',
              MedarbejderEksterntId: '35, 0035',
              MedarbejderNavn: 'Lars Larsen',
	      EnhedId: 'id-50150',
	      EnhedEksterntId: '50150',
	      EnhedNavn: 'Plif',
              StiFraRod: 'Plaf < Plif',
              Brugernavn: 'vai',
              'Email thisted.dk': 'someone@thisted.dk',
              Systemer: 'System 1',
              HomeDirectory: '',
              HomeDrive: '',
	      AktivFra: '',
	      AktivTil: '' }
        ];

        it('should return expected result', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.userAccounts(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers.default();
                    }
                }, next);
            })).to.eventually.deep.equal({
                status: 200,
                body: expected.map(o => removeBlanks(o))
            }).notify(done);
        });

        it('should return convert to CSV if requested', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.userAccounts(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers['text/csv']();
                    }
                }, next);
            }).then(function(response) {
                return csvjson.toObject(response.body, {
                    delimiter: ';', quote: '"'
                });
            })).to.eventually.deep.equal(expected).notify(done);
        });
    });

    describe('rights', function() {
        var expected = [
            { Id: 'right2',
              EksterntId: 'tokai-fbak',
              Navn: 'Rettighed-Tokai',
              Titel: 'Tokai Falilumbaknau',
              Beskrivelse: 'En Tokai Falilumbaknau er god fordi ...',
              System: '',
              KræverGodkendelse: 'true' },
            { Id: 'right1',
              EksterntId: 'trekai-trekai',
              Navn: 'Rettighed-Trekai',
              Titel: 'Trekai Knapsåvild',
              Beskrivelse: 'En Trekai Knapsåvild er okay',
              System: '',
              KræverGodkendelse: 'false' }
        ];

        it('should return expected result', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.rights(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers.default();
                    }
                }, next);
            })).to.eventually.deep.equal({
                status: 200,
                body: expected
            }).notify(done);
        });

        it('should return convert to CSV if requested', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.rights(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers['text/csv']();
                    }
                }, next);
            }).then(function(response) {
                return csvjson.toObject(response.body, {
                    delimiter: ';', quote: '"'
                });
            })).to.eventually.deep.equal(expected).notify(done);
        });
    });

    describe('locations', function() {
        var expected = [
            { Id: 'foo-location',
	      Navn: 'Foo Location',
	      EnhedId: 'id-50128',
	      EnhedEksterntId: '50128',
	      EnhedNavn: 'Plaf',
              StiFraRod: 'Plaf',
              Telefon: '32415639',
	      Adresse: 'Skolegade 15',
              PNummer: '1017491802',
	      Postnummer: '7700',
	      By: 'Thisted',
	      Land: 'Danmark',
	      AktivFra: '',
	      AktivTil: '' },
            { Id: 'bar-location',
	      Navn: 'Bar Location',
	      EnhedId: 'id-50150',
	      EnhedEksterntId: '50150',
	      EnhedNavn: 'Plif',
              StiFraRod: 'Plaf < Plif',
              Telefon: '32415638',
	      Adresse: 'Skolegade 20',
              PNummer: '1017491777',
	      Postnummer: '7700',
	      By: 'Thisted',
	      Land: 'Danmark',
	      AktivFra: '',
	      AktivTil: '' }
        ];

        it('should return expected result', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.locations(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers.default();
                    }
                }, next);
            })).to.eventually.deep.equal({
                status: 200,
                body: expected.map(o => removeBlanks(o))
            }).notify(done);
        });

        it('should return convert to CSV if requested', function(done) {
            var perspectives = this.perspectives;
            expect(new Promise(function(resolve) {
                perspectives.locations(request, {
                    send: function(body) {
                        resolve({ status: 200, body: JSON.parse(JSON.stringify(body)) });
                    },
                    set: function() {},
                    format: function(handlers) {
                        return handlers['text/csv']();
                    }
                }, next);
            }).then(function(response) {
                return csvjson.toObject(response.body, {
                    delimiter: ';', quote: '"'
                });
            })).to.eventually.deep.equal(expected).notify(done);
        });
    });
});

function _before() {
    var mockApi = { promise: {
        core: {
            query: function(args) {
                switch (args.query.relatesTo.class) {
                case models.ro.classes.unit.id:
                    return Promise.resolve({ objects: [
                        mockObject('id-50150'), mockObject('id-50128'), mockObject('id-50129-old')
                    ] });
                case models.ro.classes.employment.id:
                    return Promise.resolve({ objects: [
                        mockObject('ansaettelse'), mockObject('ansaettelse2')
                    ] });
                case models.entity.classes.hierarchy.id:
                    return Promise.resolve({ objects: [
                        mockObject('4849d400-406d-4070-a745-6fe1fe47204f')
                    ] });
                case models.ro.classes['role-assignment'].id:
                    return Promise.resolve({ objects: [
                        mockObject('ledertildeling'),
                        mockObject('altmuligmandtildeling')
                    ] });
                case models.ro.classes['user-account'].id:
                    return Promise.resolve({ objects: [
                        mockObject('user-account'),
                        mockObject('user-account2')
                    ] });
                case models.ro.classes.right.id:
                    return Promise.resolve({ objects: [
                        mockObject('right1'),
                        mockObject('right2')
                    ] });
                case models.ro.classes.location.id:
                    return Promise.resolve({ objects: [
                        mockObject('foo-location'),
                        mockObject('bar-location')
                    ] });
                default:
                    throw new Error('invalid class: ' + args.query.relatesTo.class);
                }
            }
        },
        expand: function(objects, args) {
            switch(JSON.stringify(args.path)) {
            case '"snapshot.unitType"':
                objects.forEach(function(object) {
                    object.snapshot.unitType = mockObject(object.snapshot.unitType.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.parents"':
                objects.forEach(function(object) {
                    switch (object.id) {
                    case 'id-50150':
                        object.snapshot.parents.administrativ =
                            mockObject(object.snapshot.parents.administrativ.id);
                    }
                });
                return Promise.resolve(objects);
            case '"snapshot.locations"':
                objects.forEach(function(object) {
                    if(object.snapshot.locations.foo) {
                        object.snapshot.locations.foo =
                            mockObject(object.snapshot.locations.foo.id);
                    }
                    if(object.snapshot.locations.bar) {
                        object.snapshot.locations.bar =
                            mockObject(object.snapshot.locations.bar.id);
                    }
                });
                return Promise.resolve(objects);
            case '"snapshot.organizations"':
                objects.forEach(function(object) {
                    object.snapshot.organizations.administrativ =
                        mockObject(object.snapshot.organizations.administrativ.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.ansaettelsesomraade"':
                objects.forEach(function(object) {
                    object.snapshot.ansaettelsesomraade =
                        mockObject(object.snapshot.ansaettelsesomraade.id);
                });
                return Promise.resolve(objects);
            case '["snapshot.locations","snapshot.address"]':
                objects.forEach(function(object) {
                    if (object.snapshot.locations.foo) {
                        object.snapshot.locations.foo.snapshot.address =
                            mockObject(object.snapshot.locations.foo.snapshot.address.id);
                    }
                    if (object.snapshot.locations.bar) {
                        object.snapshot.locations.bar.snapshot.address =
                            mockObject(object.snapshot.locations.bar.snapshot.address.id);
                    }
                });
                return Promise.resolve(objects);
            case '"snapshot.address"':
                objects.forEach(function(object) {
                    object.snapshot.address =
                        mockObject(object.snapshot.address.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.units"':
                objects.forEach(function(object) {
                    object.snapshot.units = [ object.id === 'foo-location'
                        ? mockObject('id-50128') : mockObject('id-50150') ];
                });
                return Promise.resolve(objects);
            case '"snapshot.employment"':
                objects.forEach(function(object) {
                    object.snapshot.employment =
                        mockObject(object.snapshot.employment.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.employedAt"':
                objects.forEach(function(object) {
                    object.snapshot.employedAt =
                        mockObject(object.snapshot.employedAt.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.propagateFrom"':
                objects.forEach(function(object) {
                    object.snapshot.propagateFrom =
                        mockObject(object.snapshot.propagateFrom.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.role"':
                objects.forEach(function(object) {
                    object.snapshot.role =
                        mockObject(object.snapshot.role.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.systems"':
                objects.forEach(function(object) {
                    object.snapshot.systems =
                        [ mockObject(object.snapshot.systems.buff.id) ];
                });
                return Promise.resolve(objects);
            case '"snapshot.responsibilities"':
                objects.forEach(function(object) {
                    object.snapshot.responsibilities = [
                        mockObject(object.snapshot.responsibilities.fooRes.id),
                        mockObject(object.snapshot.responsibilities.barRes.id)
                    ];
                });
                return Promise.resolve(objects);
            case '"snapshot.employments"':
                objects.forEach(function(object) {
                    object.snapshot.employments = [
                        mockObject(_.find(object.snapshot.employments).id)
                    ];
                });
                return Promise.resolve(objects);
            case '["snapshot.employment","snapshot.position"]':
                objects.forEach(function(object) {
                    object.snapshot.employment.snapshot.position =
                        mockObject(object.snapshot.employment.snapshot.position.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.position"':
                objects.forEach(function(object) {
                    object.snapshot.position = mockObject(object.snapshot.position.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.employee"':
                objects.forEach(function(object) {
                    object.snapshot.employee = mockObject(object.snapshot.employee.id);
                });
                return Promise.resolve(objects);
            case '["snapshot.employment","snapshot.employee"]':
                objects.forEach(function(object) {
                    object.snapshot.employment.snapshot.employee =
                        mockObject(object.snapshot.employment.snapshot.employee.id);
                });
                return Promise.resolve(objects);
            case '["snapshot.employments","snapshot.employee"]':
                objects.forEach(function(object) {
                    var employment = _.find(object.snapshot.employments);
                    employment.snapshot.employee =
                        mockObject(employment.snapshot.employee.id);
                });
                return Promise.resolve(objects);
            case '["snapshot.employments","snapshot.employedAt"]':
                objects.forEach(function(object) {
                    var employment = _.find(object.snapshot.employments);
                    employment.snapshot.employedAt =
                        mockObject(employment.snapshot.employedAt.id);
                });
                return Promise.resolve(objects);
            case '"snapshot.assignments"':
                objects.forEach(function(object) {
                    object.snapshot.assignments = [ mockObject('ledertildeling') ];
                });
                return Promise.resolve(objects);
            case '"snapshot.userAccounts"':
                objects.forEach(function(object) {
                    object.snapshot.userAccounts = [
                        object.id === 'ansaettelse' ? mockObject('user-account') : mockObject('user-account2')
                    ];
                });
                return Promise.resolve(objects);
            case '["snapshot.userAccounts","snapshot.systems"]':
                objects.forEach(function(object) {
                    Object.keys(object.snapshot.userAccounts).forEach(function(k) {
                        object.snapshot.userAccounts[k].snapshot.systems = [ mockObject('system-1') ];
                    });
                });
                return Promise.resolve(objects);
            case '["snapshot.assignments","snapshot.role"]':
                objects.forEach(function(object) {
                    object.snapshot.assignments.ledertildeling.snapshot.role =
                        mockObject(object.snapshot.assignments.ledertildeling.snapshot.role.id);
                });
                return Promise.resolve(objects);
            case '["snapshot.assignments","snapshot.employment"]':
                objects.forEach(function(object) {
                    object.snapshot.assignments.ledertildeling.snapshot.employment =
                        mockObject(object.snapshot.assignments.ledertildeling.snapshot.employment.id);
                });
                return Promise.resolve(objects);
            default:
                return Promise.reject('invalid path: ' + JSON.stringify(args.path));
            }
        } } };

    this.perspectives = new Perspectives(mockApi);
}

function mockObject(id) {
    switch (id) {
    case 'id-50150':
        return {
            id: 'id-50150',
            snapshot: {
                class: models.ro.classes.unit.ref,
                name: 'Plif',
                shortName: 'PLIF',
                parents: { administrativ: { id: 'id-50128' } },
                organizations: { administrativ: { id: 'admin-org' } },
                foreignIds: { orgUnitId: '50150' },
                unitType: { id: 'sektion' },
                costCenters: { pang: '3333' },
                locations: { bar: { id: 'bar-location' } },
                emailAddresses: { klak: 'plif@thisted.dk' },
                phoneNumbers: { klok: '23456789' },
                ean: { klik: '0123456789012' },
                seNr: '77777777'
            },
            from: '2018-01-01T00:00:00.000Z'
        };
    case 'id-50128':
        return {
            id: 'id-50128',
            snapshot: {
                class: models.ro.classes.unit.ref,
                name: 'Plaf',
                shortName: 'PLAF',
                aliases: { navnHCM: 'Første studieår - HCM' },
                organizations: { administrativ: { id: 'admin-org' } },
                foreignIds: { orgUnitId: '50128' },
                unitType: { id: 'afdeling' },
                costCenters: { pang: '4444' },
                locations: { foo: { id: 'foo-location' } },
                emailAddresses: { klak: 'plaf@thisted.dk' },
                phoneNumbers: { klok: '23456789' },
                ean: { klik: '0123456789012' },
                seNr: '77777777',
                activeFrom: '2010-01-01T00:00:00.000Z'
            },
            from: '2018-01-01T00:00:00.000Z'
        };
    case 'id-50129-old':
        return {
            id: 'id-50129-old',
            snapshot: {
                class: models.ro.classes.unit.ref,
                name: 'Første studieår',
                shortName: 'Første studieår',
                aliases: { navnHCM: 'Første studieår - HCM' },
                organizations: { administrativ: { id: 'admin-org' } },
                foreignIds: { orgUnitId: '50129' },
                unitType: { id: 'administrationsenhed' },
                emailAddresses: { klak: 'plif@thisted.dk' },
                phoneNumbers: { klok: '23456789' },
                ean: { pluf: '0123456789012' },
                seNr: '77777777',
                activeFrom: '2018-06-01T00:00:00.000Z',
                activeTo: '2018-12-01T00:00:00.000Z'
            },
            from: '2018-01-01T00:00:00.000Z'
        };
    case 'admin-org':
        return {
            id: 'admin-org',
            snapshot: {
                class: models.ro.classes.organization.ref,
                name: 'Administrativ Organisation',
                cvrNr: '29102384'
            },
            from: '2018-01-01T00:00:00.000Z'
        };
    case '4849d400-406d-4070-a745-6fe1fe47204f':
        return {
            id: '4849d400-406d-4070-a745-6fe1fe47204f',
            snapshot:
            { class: models.entity.classes.hierarchy.ref,
              name: 'Administrativt',
              pathElements: [
                  { parentType: { id: models.ro.classes.unit.id },
                    relation: 'parents.administrativ'
                  }
              ],
              from: '2018-01-01T00:00:00.000Z' } };
    case 'afdeling':
        return {
            id: 'afdeling',
            snapshot: {
                name: 'Afdeling',
                foreignIds: { opusId: '22' }
            }
        };
    case 'sektion':
        return {
            id: 'sektion',
            snapshot: {
                name: 'Sektion',
                foreignIds: { opusId: '23' }
            }
        };
    case 'foo-location':
        return {
            id: 'foo-location',
            snapshot: {
                name: 'Foo Location',
                address: { id: 'foo-address' },
                pNr: '1017491802',
                phoneNumbers: { kalif: '32415639' }
            }
        };
    case 'foo-address':
        return {
            id: 'foo-address',
            snapshot: {
                name: 'Foo Address',
                streetAddress: 'Skolegade 15',
                postalCode: '7700',
                city: 'Thisted',
                country: 'Danmark'
            }
        };
    case 'bar-location':
        return {
            id: 'bar-location',
            snapshot: {
                name: 'Bar Location',
                address: { id: 'bar-address' },
                pNr: '1017491777',
                phoneNumbers: { kalif: '32415638' }
            }
        };
    case 'bar-address':
        return {
            id: 'bar-address',
            snapshot: {
                name: 'Bar Address',
                streetAddress: 'Skolegade 20',
                postalCode: '7700',
                city: 'Thisted',
                country: 'Danmark'
            }
        };
    case 'ledertildeling':
        return {
            id: 'ledertildeling',
            snapshot: {
                class: models.ro.classes['role-assignment'].ref,
                role: { id: 'leder' },
                employment: { id: 'ansaettelse' },
                propagateFrom: { id: 'id-50128' },
                responsibilities: {
                    fooRes: { id: 'foo-res' },
                    barRes: { id: 'bar-res' }
                }
            }
        };
    case 'leder':
        return {
            id: 'leder',
            snapshot: {
                name: 'Leder',
                foreignIds: { role: '8', lederRolle: '8' },
                responsibilities: {
                    fooRes: { id: 'foo-res' },
                    barRes: { id: 'bar-res' },
                    lederRes: { id: 'leder-res' }
                }
            }
        };
    case 'altmuligmandtildeling':
        return {
            id: 'altmuligmandtildeling',
            snapshot: {
                class: models.ro.classes['role-assignment'].ref,
                role: { id: 'altmuligmand' },
                employment: { id: 'ansaettelse2' },
                propagateFrom: { id: 'id-50150' },
                responsibilities: {
                    fooRes: { id: 'foo-res' },
                    barRes: { id: 'bar-res' }
                }
            }
        };
    case 'altmuligmand':
        return {
            id: 'altmuligmand',
            snapshot: {
                name: 'Altmuligmand',
                foreignIds: { role: '9' },
                responsibilities: {
                    fooRes: { id: 'foo-res' },
                    barRes: { id: 'bar-res' }
                }
            }
        };
    case 'foo-res':
        return {
            id: 'foo-res',
            snapshot: {
                name: 'Foo Responsibility',
                foreignIds: { responsibility: '1010' },
                rettighedsgivende: true
            }
        };
    case 'bar-res':
        return {
            id: 'bar-res',
            snapshot: {
                name: 'Bar Responsibility',
                foreignIds: { responsibility: '1011' }
            }
        };
    case 'ansaettelse':
        return {
            id: 'ansaettelse',
            snapshot: {
                name: 'Ansættelse 35',
                employee: { id: 'larslarsen' },
                position: { id: 'sektionsleder' },
                employedAt: { id: 'id-50150' },
                phoneNumbers: { some: '23232323' },
                emailAddresses: {
                    some: 'someone@somewhere.com',
                    tst: 'someone@thisted.dk'
                },
                foreignIds: { opusId: '35', employeeId: '0035' }
            }
        };
    case 'ansaettelse2':
        return {
            id: 'ansaettelse2',
            snapshot: {
                name: 'Ansættelse 36',
                employee: { id: 'svendsvendsen' },
                position: { id: 'teamleder' },
                employedAt: { id: 'id-50128' },
                phoneNumbers: { some: '23232323' },
                emailAddresses: {
                    some: 'someone@somewhere.com',
                    tst: 'someone@thisted.dk'
                },
                foreignIds: { opusId: '36', employeeId: '0036' }
            }
        };
    case 'user-account':
        return {
            id: 'user-account',
            snapshot: {
                username: 'vai',
                employments: { ansaettelse: { id: 'ansaettelse' } },
                foreignIds: { aauId: '3001', staffId: '1001' },
                systems: { buff: { id: 'system-1' } }
            }
        };
    case 'user-account2':
        return {
            id: 'user-account2',
            snapshot: {
                username: 'kai',
                employments: { ansaettelse: { id: 'ansaettelse2' } },
                foreignIds: { aauId: '3002', staffId: '1002' },
                systems: { buff: { id: 'system-1' } }
            }
        };
    case 'right1':
        return {
            id: 'right1',
            snapshot: {
                name: 'Rettighed-Trekai',
                description: 'En Trekai Knapsåvild er okay',
                foreignIds: { foo: 'trekai-trekai' },
                aliases: { title: 'Trekai Knapsåvild' },
                requiresApproval: false
            }
        };
    case 'right2':
        return {
            id: 'right2',
            snapshot: {
                name: 'Rettighed-Tokai',
                description: 'En Tokai Falilumbaknau er god fordi ...',
                foreignIds: { foo: 'tokai-fbak' },
                aliases: { title: 'Tokai Falilumbaknau' },
                requiresApproval: true
            }
        };
    case 'system-1':
        return {
            id: 'system-1',
            snapshot: {
                name: 'System 1'
            }
        };
    case 'sektionsleder':
        return {
            id: 'sektionsleder',
            snapshot: {
                name: 'Sektionsleder',
                shortName: 'SEKLED',
                foreignIds: { opusId: '11' }
            }
        };
    case 'teamleder':
        return {
            id: 'teamleder',
            snapshot: {
                name: 'Teamleder',
                shortName: 'TMLED',
                foreignIds: { opusId: '12' }
            }
        };
    case 'larslarsen':
        return {
            id: 'larslarsen',
            snapshot: {
                name: 'Lars Larsen',
                givenName: 'Lars',
                familyName: 'Larsen',
                cprNr: '0101010101'
            }
        };
    case 'svendsvendsen':
        return {
            id: 'svendsvendsen',
            snapshot: {
                name: 'Svend Svendsen',
                givenName: 'Svend',
                familyName: 'Svendsen',
                cprNr: '0303030303'
            }
        };
    default:
        throw new Error('unknown object: ' + id);
    }
}

function removeBlanks(object) {
    var newo = JSON.parse(JSON.stringify(object));
    Object.keys(newo).forEach(function(key) {
        if (!newo[key]) { delete newo[key]; }
    });
    return newo;
}
