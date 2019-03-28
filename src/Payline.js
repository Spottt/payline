import soap from 'soap';
import Promise from 'bluebird';
import debugLib from 'debug';
import path from 'path';

const debug = debugLib('payline');

const DEFAULT_WSDL = path.join(__dirname, 'WebPaymentAPI.v4.44.wsdl');
const MIN_AMOUNT = 100;
const ACTIONS = {
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

const CURRENCIES = {
    EUR: 978,
    USD: 840,
    GBP: 826
};


const defaultBody = {
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
        billingAddress: {
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
        }
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
        billingAddress: {
            // street: null,
            // cityName: null,
            // zipCode: null,
            // country: null,
            // phone: null
        }
        // issueCardDate: null
    }
    // returnURL: null,
    // cancelURL: null,
    // notificationURL: null,
    // customPaymentPageCode: null,
    // privateDataList: null,
    // customPaymentTemplateURL: null,
    // contractNumberWalletList: null,
    // merchantName: null
};

export default class Payline {

    constructor(user, pass, contractNumber, wsdl = DEFAULT_WSDL, options = {}) {
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
            this.initializationPromise = Promise.fromNode(callback => {
                return soap.createClient(this.wsdl, this.options, callback);
            })
            .then(client => {
                client.setSecurity(new soap.BasicAuthSecurity(this.user, this.pass));
                client.on('request', (xml) => {
                    debug('REQUEST', xml);
                });
                client.on('response', (xml) => {
                    debug('RESPONSE', xml);
                });
                return client;
            });
        }
        return this.initializationPromise;
    }

    createOrUpdateWallet(walletId, card, update = false) {
        const wallet = {
            contractNumber: this.contractNumber,
            wallet: {
                attributes: ns('wallet'),
                walletId,
                card
            }
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.createWallet(wallet, callback);
            }))
            .spread(({ result, response }) => {
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
    createWebWallet({ walletId, firstName, lastName, email, url }) {
        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';
        const contractNumber = this.contractNumber;

        const requestBody = {
            ...defaultBody,
            buyer: {
                ...defaultBody.buyer,
                firstName,
                lastName,
                email,
                walletId
            },
            contractNumber,
            selectedContractList: [
                { selectedContract: contractNumber }
            ],
            returnURL: url,
            cancelURL: url
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.manageWebWallet(requestBody, callback);
            }))
            .spread((result, response) => {
                if (isSuccessful(result.result)) {
                    return result.redirectURL;
                }

                throw requestBody;
            }, parseErrors);
    }

    // We get SOAP errors if nested objects are not initialized.
    manageWebWallet({ walletId, firstName, lastName, email, url }) {
        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';
        const contractNumber = this.contractNumber;

        const requestBody = {
            ...defaultBody,
            buyer: {
                ...defaultBody.buyer,
                firstName,
                lastName,
                email,
                walletId
            },
            contractNumber,
            selectedContractList: [
                { selectedContract: contractNumber }
            ],
            returnURL: url,
            cancelURL: url
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.manageWebWallet(requestBody, callback);
            }))
            .spread((result, response) => {
                if (isSuccessful(result.result)) {
                    return result.redirectURL;
                }

                throw requestBody;
            }, parseErrors);
    }

    getWebPaymentDetails({ token }) {
        const version = 20;

        const requestBody = {
            version,
            token
        };

        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.getWebPaymentDetails(requestBody, callback);
            }))
            .spread((result, response) => {
                if (isSuccessful(result.result)) {
                    return result;
                }

                throw result;
            }, parseErrors);
    }

    doImmediateWalletPayment({ walletId, email, firstName, lastName, amount, mode, differedActionDate, action }) {
        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';

        const contractNumber = this.contractNumber;
        const ref = walletId;
        const date = formatNow();
        const currency = '978'; // Euros
        const deliveryMode = '5'; // electronic ticketing
        mode = mode || 'CPT';
        action = action || ACTIONS.AUTHORIZATION;
        const country = 'FR';
        const shortDate = (d) => formatDate(d).substring(0, 6) + formatDate(d).substring(8, 10);

        const payment = {
            amount,
            currency,
            action,
            mode,
            differedActionDate: mode === 'DIF' ? shortDate(differedActionDate) : null,
            contractNumber
        };

        const order = {
            ref,
            country,
            amount,
            currency,
            date,
            details: {},
            deliveryMode
        };

        const requestBody = {
            version: 20,
            payment,
            order,
            buyer: {
                ...defaultBody.buyer,
                firstName,
                lastName,
                email,
                walletId
            },
            walletId,
            privateDataList: {},
            authentication3DSecure: {},
            subMerchant: {}
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doImmediateWalletPayment(requestBody, callback);
            }))
            .spread((result, response) => {
                if (isSuccessful(result.result)) {
                    return result;
                }

                throw result;
            }, parseErrors);
    }

    doScheduledWalletPayment({ walletId, amount, differedActionDate, action, mode }) {
        const contractNumber = this.contractNumber;
        const pseudorandomstring = randomString(13, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
        const ref = `${walletId}-${pseudorandomstring}`;
        const date = formatNow();
        const currency = '978'; // Euros
        const deliveryMode = '5'; // electronic ticketing
        action = action || ACTIONS.AUTHORIZATION;
        mode = mode || 'CPT';
        const country = 'FR';
        const scheduledDate = formatDate(differedActionDate).substring(0, 10);

        const payment = {
            amount,
            currency,
            mode,
            action,
            contractNumber
        };

        const order = {
            ref,
            country,
            amount,
            currency,
            date,
            details: {},
            deliveryMode
        };

        const requestBody = {
            version: 20,
            payment,
            order,
            walletId,
            scheduledDate,
            privateDataList: {},
            authentication3DSecure: {},
            subMerchant: {}
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doScheduledWalletPayment(requestBody, callback);
            }))
            .spread((result, response) => {
                if (isSuccessful(result.result)) {
                    return result;
                }

                throw result;
            }, parseErrors);
    }

    getWallet(walletId) {
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.getWallet({
                    contractNumber: this.contractNumber,
                    walletId
                }, callback);
            }))
            .spread(({ result, wallet = null }, response) => {
                if (isSuccessful(result)) {
                    return result;
                }

                throw result;
            }, parseErrors);
    }

    getPaymentRecord({ paymentRecordId }) {
        const contractNumber = this.contractNumber;
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.getPaymentRecord({
                    contractNumber,
                    paymentRecordId
                }, callback);
            }))
            .spread((result, response) => {
                return result;
            }, parseErrors);
    }

    disablePaymentRecord({ paymentRecordId }) {
        const contractNumber = this.contractNumber;
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.disablePaymentRecord({
                    contractNumber,
                    paymentRecordId
                }, callback);
            }))
            .spread((result, response) => {
                return result;
            }, parseErrors);
    }

    makeWalletPayment(walletId, amount, currency = CURRENCIES.EUR) {
        const body = {
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
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doImmediateWalletPayment(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return { transactionId: transaction.id };
                }

                throw result;
            }, parseErrors);
    }

    validateCard(card, tryAmount = 100, currency = CURRENCIES.EUR) {
        // 1 is the minimum here
        tryAmount = Math.max(tryAmount, MIN_AMOUNT);
        var client;
        return this.initialize()
            .then((c) => Promise.fromNode(callback => {
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
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return Promise.fromNode(callback => client.doReset({
                        transactionID: transaction.id,
                        comment: 'Card validation cleanup'
                    }, callback))
                    .return(true);
                }

                return false;
            }, parseErrors);
    }

    doAuthorization(reference, card, tryAmount, currency = CURRENCIES.EUR) {
        const body = {
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
        return this.initialize()
                .then(client => Promise.fromNode(callback => {
                    client.doAuthorization(body, callback);
                }))
                .spread(({ result, transaction = null }) => {
                    if (isSuccessful(result)) {
                        return { transactionId: transaction.id };
                    }

                    throw result;
                }, parseErrors);
    }

    doCapture(transactionID, tryAmount, currency = CURRENCIES.EUR) {
        const body = {
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
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doCapture(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                if (isSuccessful(result)) {
                    return { transactionId: transaction.id };
                }

                throw result;
            }, parseErrors);
    }

    doReset({ transactionID }) {
        const body = {
            transactionID
        };
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doReset(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                return result;
            }, parseErrors);
    }

    doRefund({ transactionID, amount, currency = CURRENCIES.EUR }) {
        const tryAmount = amount;
        const body = {
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
        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doRefund(body, callback);
            }))
            .spread(({ result, transaction = null }) => {
                return result;
            }, parseErrors);
    }

    doWebPayment({ amount, walletId, firstName, lastName, email, redirectURL, notificationURL }) {
        firstName = firstName || 'N/A';
        lastName = lastName || 'N/A';
        amount = Number.isNaN(Number(amount)) ? 100 : Number(amount);

        const contractNumber = this.contractNumber;
        const now = (new Date()).getTime();
        const ref = `${walletId}-${now}`;
        const date = formatNow();
        const currency = '978'; // Euros
        const deliveryMode = '5'; // electronic ticketing
        const mode = 'CPT';
        const action = ACTIONS.AUTHORIZATION;
        const country = 'FR';

        const payment = {
            attributes: ns('payment'),
            amount,
            currency,
            action,
            mode,
            contractNumber
        };

        const order = {
            attributes: ns('order'),
            ref,
            country,
            amount,
            currency,
            date,
            details: {},
            deliveryMode
        };

        const buyer = {
            ...defaultBody.buyer,
            attributes: ns('buyer'),
            firstName,
            lastName,
            email,
            walletId
        };

        const body = {
            ...defaultBody,
            payment,
            order,
            buyer,
            selectedContractList: [
                { selectedContract: contractNumber }
            ],
            returnURL: redirectURL,
            cancelURL: redirectURL,
            notificationURL,
            securityMode: 'SSL'
        };

        return this.initialize()
            .then(client => Promise.fromNode(callback => {
                client.doWebPayment(body, callback);
            }))
            .spread(response => {
                if (isSuccessful(response.result)) {
                    return response;
                }

                throw response.result;
            }, parseErrors);
    }
}

Payline.CURRENCIES = CURRENCIES;

function parseErrors(error) {
    const response = error.response;
    if (response.statusCode === 401) {
        return Promise.reject({ shortMessage: 'Wrong API credentials' });
    }

    return Promise.reject({ shortMessage: 'Wrong API call' });
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
    return `${(day[1] ? day : `0${day[0]}`)}/${(month[1] ? month : `0${month[0]}`)}/${year} ${(hour[1] ? hour : `0${hour[0]}`)}:${(minute[1] ? minute : `0${minute[0]}`)}`;
}

function formatNow() {
    var now = new Date();
    return formatDate(now);
}


function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
}
