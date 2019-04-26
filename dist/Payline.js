Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _soap = require('soap');

var _soap2 = _interopRequireDefault(_soap);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug2.default)('payline');

var DEFAULT_WSDL = _path2.default.join(__dirname, 'WebPaymentAPI.v4.44.wsdl');
var MIN_AMOUNT = 100;
var ACTIONS = {
    AUTHORIZATION: 100,
    PAYMENT: 101, // validation + payment
    VALIDATION: 201
};

// soap library has trouble loading element types
// so we sometimes have to override inferred namespace
function ns(type) {
    return {
        xsi_type: {
            type,
            xmlns: 'http://obj.ws.payline.experian.com'
        }
    };
}

var CURRENCIES = {
    EUR: 978,
    USD: 840,
    GBP: 826
};

var defaultBody = {
    version: 20,
    // contractNumber,
    selectedContractList: [],
    updatePersonalDetails: 0,
    buyer: {
        // title: null,
        // lastName: null,
        // firstName: null,
        // email: null,
        shippingAddress: {
            //     title: null,
            //     name: null,
            //     firstName: null,
            //     lastName: null,
            //     street1: null,
            //     street2: null,
            //     cityName: null,
            //     zipCode: null,
            //     country: null,
            //     phone: null,
            //     state: null,
            //     county: null,
            //     phoneType: null
        },
        billingAddress: {}
        //     title: null,
        //     name: null,
        //     firstName: null,
        //     lastName: null,
        //     street1: null,
        //     street2: null,
        //     cityName: null,
        //     zipCode: null,
        //     country: null,
        //     phone: null,
        //     state: null,
        //     county: null,
        //     phoneType: null

        // accountCreateDate: null,
        // accountAverageAmount: null,
        // accountOrderCount: null,
        // walletId
        // walletDisplayed: null,
        // walletSecured: null,
        // walletCardInd: null,
        // ip: null,
        // mobilePhone: null,
        // customerId: null,
        // legalStatus: null,
        // legalDocument: null,
        // birthDate: null,
        // fingerprintID: null,
        // isBot: null,
        // isIncognito: null,
        // isBehindProxy: null,
        // isFromTor: null,
        // isEmulator: null,
        // isRooted: null,
        // hasTimezoneMismatch: null
    },
    owner: {
        // lastName: null,
        // firstName: null,
        billingAddress: {}
        // street: null,
        // cityName: null,
        // zipCode: null,
        // country: null,
        // phone: null

        // issueCardDate: null

        // returnURL: null,
        // cancelURL: null,
        // notificationURL: null,
        // customPaymentPageCode: null,
        // privateDataList: null,
        // customPaymentTemplateURL: null,
        // contractNumberWalletList: null,
        // merchantName: null
    } };

class Payline {

    constructor(user, pass, contractNumber) {
        var wsdl = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : DEFAULT_WSDL;
        var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

        if (!user || !pass || !contractNumber) {
            throw new Error('All of user / pass / contractNumber should be defined');
        }
        this.user = user;
        this.pass = pass;
        this.contractNumber = contractNumber;
        this.wsdl = wsdl;
        this.options = options;
    }

    initialize() {
        if (!this.initializationPromise) {
            this.initializationPromise = _bluebird2.default.fromNode(callback => {
                return _soap2.default.createClient(this.wsdl, this.options, callback);
            }).then(client => {
                client.setSecurity(new _soap2.default.BasicAuthSecurity(this.user, this.pass));
                client.on('request', xml => {
                    debug('REQUEST', xml);
                });
                client.on('response', xml => {
                    debug('RESPONSE', xml);
                });
                return client;
            });
        }
        return this.initializationPromise;
    }

    createOrUpdateWallet(walletId, card) {
        var update = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var wallet = {
            contractNumber: this.contractNumber,
            wallet: {
                attributes: ns('wallet'),
                walletId,
                card
            }
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.createWallet(wallet, callback);
        })).spread((_ref) => {
            var { result, response } = _ref;

            if (isSuccessful(result)) {
                return { walletId };
            }

            throw result;
        }, parseErrors);
    }

    updateWallet(walletId, card) {
        return this.createOrUpdateWallet.apply(this, [walletId, card, true]);
    }

    createWallet(walletId, card) {
        return this.createOrUpdateWallet.apply(this, [walletId, card, false]);
    }

    // We get SOAP errors if nested objects are not initialized.
    createWebWallet(_ref2) {
        var { walletId, firstName, lastName, email, url } = _ref2;

        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';
        var contractNumber = this.contractNumber;

        var requestBody = _extends({}, defaultBody, {
            buyer: _extends({}, defaultBody.buyer, {
                firstName,
                lastName,
                email,
                walletId
            }),
            contractNumber,
            selectedContractList: [{ selectedContract: contractNumber }],
            returnURL: url,
            cancelURL: url
        });
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.manageWebWallet(requestBody, callback);
        })).spread((result, response) => {
            return result;
        }, parseErrors);
    }

    // We get SOAP errors if nested objects are not initialized.
    manageWebWallet(_ref3) {
        var { walletId, firstName, lastName, email, url } = _ref3;

        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';
        var contractNumber = this.contractNumber;

        var requestBody = _extends({}, defaultBody, {
            buyer: _extends({}, defaultBody.buyer, {
                firstName,
                lastName,
                email,
                walletId
            }),
            contractNumber,
            selectedContractList: [{ selectedContract: contractNumber }],
            returnURL: url,
            cancelURL: url
        });
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.manageWebWallet(requestBody, callback);
        })).spread((result, response) => {
            if (isSuccessful(result.result)) {
                return result.redirectURL;
            }

            throw requestBody;
        }, parseErrors);
    }

    getWebPaymentDetails(_ref4) {
        var { token } = _ref4;

        var version = 20;

        var requestBody = {
            version,
            token
        };

        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.getWebPaymentDetails(requestBody, callback);
        })).spread((result, response) => {
            if (isSuccessful(result.result)) {
                return result;
            }

            throw result;
        }, parseErrors);
    }

    doImmediateWalletPayment(_ref5) {
        var { walletId, email, firstName, lastName, amount, mode, differedActionDate, action } = _ref5;

        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';

        var contractNumber = this.contractNumber;
        var ref = walletId;
        var date = formatNow();
        var currency = '978'; // Euros
        var deliveryMode = '5'; // electronic ticketing
        mode = mode || 'CPT';
        action = action || ACTIONS.AUTHORIZATION;
        var country = 'FR';
        var shortDate = d => formatDate(d).substring(0, 6) + formatDate(d).substring(8, 10);

        var payment = {
            amount,
            currency,
            action,
            mode,
            differedActionDate: mode === 'DIF' ? shortDate(differedActionDate) : null,
            contractNumber
        };

        var order = {
            ref,
            country,
            amount,
            currency,
            date,
            details: {},
            deliveryMode
        };

        var requestBody = {
            version: 20,
            payment,
            order,
            buyer: _extends({}, defaultBody.buyer, {
                firstName,
                lastName,
                email,
                walletId
            }),
            walletId,
            privateDataList: {},
            authentication3DSecure: {},
            subMerchant: {}
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doImmediateWalletPayment(requestBody, callback);
        })).spread((result, response) => {
            if (isSuccessful(result.result)) {
                return result;
            }

            throw result;
        }, parseErrors);
    }

    doScheduledWalletPayment(_ref6) {
        var { walletId, amount, differedActionDate, action, mode } = _ref6;

        var contractNumber = this.contractNumber;
        var pseudorandomstring = randomString(13, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
        var ref = `${walletId}-${pseudorandomstring}`;
        var date = formatNow();
        var currency = '978'; // Euros
        var deliveryMode = '5'; // electronic ticketing
        action = action || ACTIONS.AUTHORIZATION;
        mode = mode || 'CPT';
        var country = 'FR';
        var scheduledDate = formatDate(differedActionDate).substring(0, 10);

        var payment = {
            amount,
            currency,
            mode,
            action,
            contractNumber
        };

        var order = {
            ref,
            country,
            amount,
            currency,
            date,
            details: {},
            deliveryMode
        };

        var requestBody = {
            version: 20,
            payment,
            order,
            walletId,
            scheduledDate,
            privateDataList: {},
            authentication3DSecure: {},
            subMerchant: {}
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doScheduledWalletPayment(requestBody, callback);
        })).spread((result, response) => {
            if (isSuccessful(result.result)) {
                return result;
            }

            throw result;
        }, parseErrors);
    }

    getWallet(walletId) {
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.getWallet({
                contractNumber: this.contractNumber,
                walletId
            }, callback);
        })).spread((result, response) => {
            if (isSuccessful(result.result)) {
                return result;
            }

            throw result;
        }, parseErrors);
    }

    getPaymentRecord(_ref7) {
        var { paymentRecordId } = _ref7;

        var contractNumber = this.contractNumber;
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.getPaymentRecord({
                contractNumber,
                paymentRecordId
            }, callback);
        })).spread((result, response) => {
            return result;
        }, parseErrors);
    }

    disablePaymentRecord(_ref8) {
        var { paymentRecordId } = _ref8;

        var contractNumber = this.contractNumber;
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.disablePaymentRecord({
                contractNumber,
                paymentRecordId
            }, callback);
        })).spread((result, response) => {
            return result;
        }, parseErrors);
    }

    makeWalletPayment(walletId, amount) {
        var currency = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : CURRENCIES.EUR;

        var body = {
            payment: {
                attributes: ns('payment'),
                amount,
                currency,
                action: ACTIONS.PAYMENT,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            order: {
                attributes: ns('order'),
                ref: `order_${generateId()}`,
                amount,
                currency,
                date: formatNow()
            },
            walletId
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doImmediateWalletPayment(body, callback);
        })).spread((_ref9) => {
            var { result, transaction = null } = _ref9;

            if (isSuccessful(result)) {
                return { transactionId: transaction.id };
            }

            throw result;
        }, parseErrors);
    }

    validateCard(card) {
        var tryAmount = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 100;
        var currency = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : CURRENCIES.EUR;

        // 1 is the minimum here
        tryAmount = Math.max(tryAmount, MIN_AMOUNT);
        var client;
        return this.initialize().then(c => _bluebird2.default.fromNode(callback => {
            client = c;
            client.doAuthorization({
                payment: {
                    attributes: ns('payment'),
                    amount: tryAmount,
                    currency,
                    action: ACTIONS.AUTHORIZATION,
                    mode: 'CPT',
                    contractNumber: this.contractNumber
                },
                order: {
                    attributes: ns('order'),
                    ref: `order_${generateId()}`,
                    amount: tryAmount,
                    currency,
                    date: formatNow()
                },
                card: {
                    attributes: ns('card'),
                    number: card.number,
                    type: card.type,
                    expirationDate: card.expirationDate,
                    cvx: card.cvx
                }
            }, callback);
        })).spread((_ref10) => {
            var { result, transaction = null } = _ref10;

            if (isSuccessful(result)) {
                return _bluebird2.default.fromNode(callback => client.doReset({
                    transactionID: transaction.id,
                    comment: 'Card validation cleanup'
                }, callback)).return(true);
            }

            return false;
        }, parseErrors);
    }

    doAuthorization(reference, card, tryAmount) {
        var currency = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : CURRENCIES.EUR;

        var body = {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency,
                action: ACTIONS.AUTHORIZATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            order: {
                attributes: ns('order'),
                ref: reference,
                amount: tryAmount,
                currency,
                date: formatNow()
            },
            card: {
                attributes: ns('card'),
                number: card.number,
                type: card.type,
                expirationDate: card.expirationDate,
                cvx: card.cvx
            }
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doAuthorization(body, callback);
        })).spread((_ref11) => {
            var { result, transaction = null } = _ref11;

            if (isSuccessful(result)) {
                return { transactionId: transaction.id };
            }

            throw result;
        }, parseErrors);
    }

    doCapture(transactionID, tryAmount) {
        var currency = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : CURRENCIES.EUR;

        var body = {
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency,
                action: ACTIONS.VALIDATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            },
            transactionID
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doCapture(body, callback);
        })).spread((_ref12) => {
            var { result, transaction = null } = _ref12;

            if (isSuccessful(result)) {
                return { transactionId: transaction.id };
            }

            throw result;
        }, parseErrors);
    }

    doReset(_ref13) {
        var { transactionID } = _ref13;

        var body = {
            transactionID
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doReset(body, callback);
        })).spread((_ref14) => {
            var { result, transaction = null } = _ref14;

            return result;
        }, parseErrors);
    }

    doRefund(_ref15) {
        var { transactionID, amount, currency = CURRENCIES.EUR } = _ref15;

        var tryAmount = amount;
        var body = {
            transactionID,
            payment: {
                attributes: ns('payment'),
                amount: tryAmount,
                currency,
                action: ACTIONS.VALIDATION,
                mode: 'CPT',
                contractNumber: this.contractNumber
            }
        };
        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doRefund(body, callback);
        })).spread((_ref16) => {
            var { result, transaction = null } = _ref16;

            return result;
        }, parseErrors);
    }

    doWebPayment(_ref17) {
        var { amount, walletId, firstName, lastName, email, redirectURL, notificationURL } = _ref17;

        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';
        amount = Number.isNaN(Number(amount)) ? 100 : Number(amount);

        var contractNumber = this.contractNumber;
        var now = new Date().getTime();
        var ref = `${walletId}-${now}`;
        var date = formatNow();
        var currency = '978'; // Euros
        var deliveryMode = '5'; // electronic ticketing
        var mode = 'CPT';
        var action = ACTIONS.AUTHORIZATION;
        var country = 'FR';

        var payment = {
            attributes: ns('payment'),
            amount,
            currency,
            action,
            mode,
            contractNumber
        };

        var order = {
            attributes: ns('order'),
            ref,
            country,
            amount,
            currency,
            date,
            details: {},
            deliveryMode
        };

        var buyer = _extends({}, defaultBody.buyer, {
            attributes: ns('buyer'),
            firstName,
            lastName,
            email,
            walletId
        });

        var body = _extends({}, defaultBody, {
            payment,
            order,
            buyer,
            selectedContractList: [{ selectedContract: contractNumber }],
            returnURL: redirectURL,
            cancelURL: redirectURL,
            notificationURL,
            securityMode: 'SSL'
        });

        return this.initialize().then(client => _bluebird2.default.fromNode(callback => {
            client.doWebPayment(body, callback);
        })).spread(response => {
            if (isSuccessful(response.result)) {
                return response;
            }

            throw response.result;
        }, parseErrors);
    }
}

exports.default = Payline;
Payline.CURRENCIES = CURRENCIES;

function parseErrors(error) {
    var response = error.response;
    if (response.statusCode === 401) {
        return _bluebird2.default.reject({ shortMessage: 'Wrong API credentials' });
    }

    return _bluebird2.default.reject({ shortMessage: 'Wrong API call' });
}

function generateId() {
    return `${Math.ceil(Math.random() * 100000)}`;
}

function isSuccessful(result) {
    return result && ['02500', '00000'].indexOf(result.code) !== -1;
}

function formatDate(date) {
    var year = date.getFullYear().toString();
    var month = (date.getMonth() + 1).toString(); // getMonth() is zero-based
    var day = date.getDate().toString();
    var hour = date.getHours().toString();
    var minute = date.getMinutes().toString();
    // DD/MM/YYYY HH:mm
    return `${day[1] ? day : `0${day[0]}`}/${month[1] ? month : `0${month[0]}`}/${year} ${hour[1] ? hour : `0${hour[0]}`}:${minute[1] ? minute : `0${minute[0]}`}`;
}

function formatNow() {
    var now = new Date();
    return formatDate(now);
}

function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) {
        result += chars[Math.round(Math.random() * (chars.length - 1))];
    }return result;
}