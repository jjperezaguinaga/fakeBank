'use strict';
console.log('fakeBank starting');
var accounts = require('./controllers/accounts');
var cards = require('./controllers/cards');
var beneficiaries = require('./controllers/beneficiaries');
var transfer = require('./controllers/transfer');
var user = require('./controllers/user');
var rates = require('./controllers/rates');
var compress = require('koa-compress');
var logger = require('koa-logger');
var serve = require('koa-static');
var route = require('koa-route');
var koa = require('koa');
var cors = require('koa-cors');
var path = require('path');
var app = module.exports = koa();
var noCache = require('koa-no-cache');



var db = {},
    Datastore = require('nedb');
var wrap = require('co-ne-db');
db.tokens = new Datastore('db_tokens');
db.tokens.loadDatabase();
db.tokens = wrap(db.tokens);
app.db = {};

app.db.users = new Datastore('db_users');
app.db.users.loadDatabase();
app.db.users = wrap(app.db.users);
app.db.userDetails = new Datastore('db_userDetails');
app.db.userDetails.loadDatabase();
app.db.userDetails = wrap(app.db.userDetails);
app.db.beneficiaries = new Datastore('db_beneficiaries');
app.db.beneficiaries.loadDatabase();
app.db.beneficiaries = wrap(app.db.beneficiaries);
app.db.accounts = new Datastore('db_accounts');
app.db.accounts.loadDatabase();
app.db.accounts = wrap(app.db.accounts);
app.db.cards = new Datastore('db_cards');
app.db.cards.loadDatabase();
app.db.cards = wrap(app.db.cards);
app.db.transactions = new Datastore('db_transactions');
app.db.transactions.loadDatabase();
app.db.transactions = wrap(app.db.transactions);
app.db.rates = new Datastore('db_rates');
app.db.rates.loadDatabase();
app.db.rates = wrap(app.db.rates);


var generator = require('./generator/processor');
generator.doImport(app).next();

rates.doImportRates(app).next();








app.use(logger());

app.use(noCache({
    global: true
}));

var options = {
    origin: '*' //???###!!! Change access control origin
};
app.use(cors(options));

app.use(route.options('/', accounts.options));
app.use(route.trace('/', accounts.trace));
app.use(route.head('/', accounts.head));
app.use(serve(path.join(__dirname, 'public')));

//any route above does not require tokens
app.use(function* (next) {

    this.request.scrap = this.request.scrap || {};
    this.request.scrap.userId = undefined;
    if (this.request.headers && this.request.headers.token) {
        console.log('got token', this.request.headers.token);
        //validate if token given in the header does exist in DB. 
        var tokens = yield db.tokens.find({
            token: this.request.headers.token
        }).exec();
        if (!tokens) this.throw(500, JSON.stringify({
            error: true,
            text: "Error reading tokens"
        }));
        if (tokens.length < 1) this.throw(404, JSON.stringify({
            error: true,
            text: "Wrong token"
        }));
        console.log('validated token', this.request.headers.token, 'belongs to userId', tokens[0].userId);
        this.request.scrap.userId = tokens[0].userId;
    } else {
        this.throw(404, JSON.stringify({
            error: true,
            text: "No token in the header"
        }));
    }
    yield next;
});
//any route below does require tokens


app.use(route.get('/accounts/', accounts.all));
app.use(route.get('/accounts/:id', accounts.fetch));
app.use(route.post('/accounts/:id', accounts.modify));
app.use(route.put('/accounts/', accounts.add));

//GET /accounts/:id/transactions/:dateStart/:dateEnd -> List all the transactions of the account for the given ID which happened between the given dates
app.use(route.get('/accounts/:id/transactions/:dateStart/:dateEnd', accounts.transactions));
app.use(route.put('/accounts/:id/transactions/', accounts.transactionAdd));
app.use(route.post('/accounts/transactions/:id', accounts.transactionModify));


//GET /cards/ -> List all the cards in JSON.
app.use(route.get('/cards/', cards.all));
//GET /cards/:id -> Returns the card for the given ID
app.use(route.get('/cards/:id', cards.fetch));
//POST /cards/:id -> Changes properties of the given card
app.use(route.post('/cards/:id/:onoff', cards.onoff));
app.use(route.post('/cards/:id', cards.modify));
//PUT /cards/ -> Creates a new card
app.use(route.put('/cards/', cards.add));


//GET /beneficiaries/ -> List all the beneficiaries in JSON.
app.use(route.get('/beneficiaries/', beneficiaries.all));
//GET /beneficiaries/:id -> Returns the beneficiary for the given ID
app.use(route.get('/beneficiaries/:id', beneficiaries.fetch));
//POST /beneficiaries/:id -> Edits the beneficiary with the specified ID.
app.use(route.post('/beneficiaries/:id', beneficiaries.modifyBeneficiary));
//DELETE /beneficiaries/:id -> Removes the beneficiary with the specified ID.
app.use(route.delete('/beneficiaries/:id', beneficiaries.deleteBeneficiary));

//POST /transfer/acc2acc -> Makes a transfer
app.use(route.post('/transfer/acc2acc', transfer.acc2acc));


//GET /user/ -> User details in JSON.
app.use(route.get('/user/', user.fetch));
//POST /user/ -> Change user details
app.use(route.get('/user/', user.modify));
//POST /user/ -> Change user password
app.use(route.get('/user/password', user.passwordChange));


//GET /rates/ -> Currency rates in JSON.
app.use(route.get('/rates/', rates.all));
//POST /rates/ -> Adds or modifies existing rate
app.use(route.post('/rates/', rates.upsert));

// Serve static files
app.use(serve(path.join(__dirname, 'public'))); //!!!TODO Why serving public pages again? Is this line a duplicate? See above

// Compress
app.use(compress());

if (!module.parent) {
    app.listen(1337);
    console.log('listening on port 1337');
}
