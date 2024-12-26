import Vue from "vue";
import { OpenStreetMapProvider } from "leaflet-geosearch";
import CountriesTimezones from "countries-and-timezones";
import CityTimezones from "city-timezones";
import VueI18n, { currencies } from "@/i18n/index.js";

import Account from "@/js/models/account.js";
import Offer from "@/js/models/offer.js";
import OfferScore from "@/js/models/offerScore.js";
import Comment from "@/js/models/comment.js";
import AppErrors from "@/js/appErrors.js";

/**
 * Allow work with bastyon
 * 
 * @class SDK
 */
class SDK {
	lastresult = "";
	emitted = [];
	localstorage = "";
	requestServiceData = {
		ids: {
			getBrtOffersFeed: 0,
		},
	};

	models = {
		Account,
		Offer,
		OfferScore,
		Comment
	};

	txTypes = {
		contentDelete: {
			code: 207,
			name: 'contentDelete',
		}
	};

	_appinfo = null;
	get appinfo() {
		if (!this._appinfo) this.getAppInfo();
		return this._appinfo;
	}

	_address = "";
	get address() {
		if (!this._address) this.getAddress();
		return this._address;
	}

	_balance = {};
	get balance() {
		if (!Object.keys(this._balance).length) this.getBalance();
		return this._balance;
	}

	_location = {};
	get location() {
		if (this.empty(this._location)) {
			this.requestUserLocation(false, false);
		}
		return this._location;
	}

	_currency = {};
	get currency() {
		if (this.empty(this._currency)) this.getCurrency();

		return this._currency;
	}

	/**
	 * Get language by locale
	 * 
	 * @param {String} locale
	 * 
	 * @returns {String}
	 */
	getLanguageByLocale(locale) {
		return String(locale || "").split("-").shift();
	}

	/**
	 * Get error message
	 * 
	 * @param {Object} error
	 * @param {Object} options
	 * 
	 * @returns {String}
	 */
	errorMessage(
		error, 
		options = {
			key: null,
			details: null,
		}
	) {
		let key = options?.key
		if (!key) {
			const
				getKey = (code) => `dialogLabels.error#${ code }`,
				defaultCode = 0,
				parsedCode = `${ error?.toString()?.replace(/[^\d-]/g, "") || defaultCode }`,
				resultCode = VueI18n.te(getKey(parsedCode)) ? parsedCode : defaultCode;
			
			key = getKey(resultCode);
		}

		const details = options?.details || error?.message || error?.toString();

		return VueI18n.t(key, { error: details });
	}

	/**
	 * Check if Array/Object is empty
	 * 
	 * @param {*} prop
	 * 
	 * @returns {*}
	 */
	empty(prop) {
		return !prop || prop && !Object.entries(prop).length;
	}

	/**
	 * If empty return reference
	 * 
	 * @param {*} prop
	 * @param {*} reference
	 * 
	 * @returns {*}
	 */
	ifEmpty(prop, reference) {
		return this.empty(prop) ? reference : prop;
	}

	cyrb53(str, seed = 0) {
		let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;

		for(let i = 0, ch; i < str.length; i++) {
				ch = str.charCodeAt(i);
				h1 = Math.imul(h1 ^ ch, 2654435761);
				h2 = Math.imul(h2 ^ ch, 1597334677);
		}

		h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
		h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
		h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
		h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	
		return 4294967296 * (2097151 & h2) + (h1 >>> 0);
	}

	hexEncode= function(text) {
		var ch = 0;
		var result = "";
		for (var i = 0; i < text.length; i++)
		{
			ch = text.charCodeAt(i);
			if (ch > 0xFF) ch -= 0x350;
			ch = ch.toString(16);
			while (ch.length < 2) ch = "0" + ch;
			result += ch;
		}
		return result;
	}

	hexDecode= function(hex) {
		var ch = 0;
		var result = "";
		hex = trim(hex);
		for (var i = 2; i <= hex.length; i += 2)
		{
			ch = parseInt(hex.substring(i - 2, i), 16);
			if (ch >= 128) ch += 0x350;
			ch = String.fromCharCode("0x" + ch.toString(16));
			result += ch;
		}
		return result;
	}	

	constructor() {
		if (SDK._instance) {
			return SDK._instance;
		}
		
		if (!window.BastyonSdk) return;

		SDK._instance = this;

		const $ = this;

		this.sdk = new window.BastyonSdk();
		this.sdk.init();

		this.emit = this.sdk.emit;
		this.on = this.sdk.on;
		this.off = this.sdk.off;

		this.on("action", d => {
			const action = JSON.stringify(d);

			this.emitted.push({
				type : "action",
				data : action,
				date : new Date(),
			});
		});

		this.on("balance", balance => {
			this._balance = balance;
			this.emitted.push({
				type : "balance",
				data : JSON.stringify(balance),
				date : new Date(),
			})
		});

		this.emit("loaded");

		/**
		 * Reactive observable
		 */

		/* Reactive accounts */
		this._accounts = {};

		/* Observe accounts watcher */
		this.accounts = new Proxy(this._accounts, {
			get(target, address) {
				if (typeof address !== "string" || address?.length < 32) return this;
				else if (!target?.[address]) $.getUserProfile(address);
				return target?.[address];
			}
		});

		/* Inner storage */
		this.barteron = {
			_accounts: {},
			_offers: {},
			_details: {},
			_offerScores: {},
			_comments: {}
		};

		/* Observe sub-objects watchers */
		this.barteron = {
			...this.barteron,

			/* Barteron account */
			accounts: new Proxy(this.barteron._accounts, {
				get(target, address) {
					if (typeof address !== "string" || address?.length < 32) return this;
					else if (!target?.[address]) $.getBrtAccount(address);
					return target?.[address];
				}
			}),

			/* Barteron offers */
			offers: new Proxy(this.barteron._offers, {
				get(target, hash) {
					if (hash !== "draft" && (typeof hash !== "string" || hash?.length < 64)) return this;
					else if (!target?.[hash]) $.getBrtOffersByHashes([hash]);
					return target?.[hash];
				}
			}),

			/* Barteron offers details */
			details: new Proxy(this.barteron._details, {
				get(target, hash) {
					if (hash !== "draft" && (typeof hash !== "string" || hash?.length < 64)) return this;
					else if (!target?.[hash]) $.getBrtOffersDetails({ offerIds: [hash] });
					return target?.[hash];
				}
			}),

			/* Barteron offers scores */
			offerScores: new Proxy(this.barteron._offerScores, {
				get(target, hash) {
					if (hash !== "draft" && (typeof hash !== "string" || hash?.length < 64)) return this;
					return target?.[hash];
				}
			}),

			/* Barteron offers comments */
			comments: new Proxy(this.barteron._comments, {
				get(target, hash) {
					if (hash !== "draft" && (typeof hash !== "string" || hash?.length < 64)) return this;
					return target?.[hash];
				}
			})
		}
	}

	setLastResult(e) {
		this.lastresult = e;
	}

	clearLastResult() {
		this.setLastResult("");
	}

	/**
	 * Get app info
	 * 
	 * @returns {Promise}
	 */
	getAppInfo() {
		return this.sdk.get.appinfo().then(info => {
			this.lastresult = "appinfo: " + info;
			Vue.set(this, "_appinfo", info);
			return info;
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Get logged user state
	 * 
	 * @returns {Promise}
	 */
	isLoggedIn() {
		return this.sdk.helpers.userstate().then(result => {
			this.lastresult = `isLoggedIn: ${ result }`
			return result;
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Open app settings
	 * 
	 * @returns {Promise}
	 */
	openSettings() {
		return this.sdk.helpers.opensettings().then(() => {
			this.lastresult = "opensettings: success";
			return null;
		}).catch(e => this.setLastResult(e));
	}
	
	/**
	 * Open registration page
	 * 
	 * @returns {Promise}
	 */
	openRegistration() {
		return this.sdk.helpers.registration().then(() => {
			this.lastresult = "openregistration: success";
			return null;
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Get local route from data
	 * 
	 * @param {String} route
	 * 
	 * @returns {String}
	 */
	getRoute(route) {
		return this.sdk.getroute(route);
	}

	/**
	 * Create room in chat
	 * 
	 * @param {Object} request
	 * @param {String} request.name
	 * @param {Array} request.members
	 * @param {Boolean} request.equal
	 * 
	 * @returns {Promise}
	 */
	createRoom(request) {
		return new Promise((resolve, reject) => {
			/* Request for permissons */
			this.requestPermissions(["chat"]).then(result => {
				if (result) {
					this.sdk.chat.getOrCreateRoom({
						users: request.members,
						parameters: {
							name: request.name,
							equal: request.equal
						}
					})
					.then(resolve)
					.catch(reject);
				} else {
					reject(result);
				}
			});
		});
	}

	/**
	 * Open chat room
	 * 
	 * @param {String} roomid
	 * 
	 * @returns {Promise}
	 */
	openRoom(roomId) {
		return this.sdk.chat.openRoom(roomId);
	}

	/**
	 * Send message to chat
	 * 
	 * @param {Object} request
	 * @param {String} request.roomid
	 * @param {Object} request.content
	 * @param {Array} request.content.messages
	 * @param {Array} request.content.images
	 * 
	 * @returns {Promise}
	 */
	sendMessageInRoom(request) {
		return new Promise((resolve, reject) => {
			/* Request for permissons */
				const items = ["chat"];
				this.requestPermissions(items).then(result => {
					if (result) {
						this.sdk.chat.send(request)
							.then(resolve)
							.catch(reject);
					} else {
						let error = new Error(`Error occurred while requesting permission(s): ${items.join(', ')}`);
						reject(error);
					}
				});
		});
	}

	/**
	 * Get applink from local
	 * 
	 * @param {String} url
	 * 
	 * @returns {String}
	 */
	appLink(url) {
		return this.sdk.get.applink(url);
	}

	/**
	 * Open external link
	 * 
	 * @param {String} url
	 * 
	 * @returns {Promise}
	 */
	openExternalLink(url) {
		return this.sdk.openExternalLink(url);
	}

	/**
	 * Share resource
	 * 
	 * @param {Object} data
	 * @param {String} data.path
	 * @param {Object} data.sharing
	 * @param {String} data.sharing.title
	 * @param {Object} data.sharing.text
	 * @param {String} data.sharing.text.body
	 * 
	 * @returns {Void}
	 */
	share(data) {
		return this.sdk.helpers.share(data).then(() => {
			this.lastresult = "share: success"
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Get image from mobile camera
	 * 
	 * @returns {Promise}
	 */
	imageFromMobileCamera() {
		return this.sdk.get.imageFromMobileCamera().then(images => {
			this.lastresult = "imageFromMobileCamera: success (console.log)"
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Show alert message
	 * 
	 * @returns {Promise}
	 */
	alertMessage(message) {
		return this.sdk.helpers.alert(message).then(() => {
			this.lastresult = "alert: success"
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Get action
	 * 
	 * @param {Object} data
	 * 
	 * @returns {Promise}
	 */
	getAction(data) {
		return this.sdk.get.action(data);
	}

	/**
	 * Get offer actions
	 * 
	 * @returns {Promise}
	 */
	getOfferActions() {
		return this.sdk.get.actions().then(actions => {
			return Promise.all(
				(actions || [])
					.filter(action => this.isOfferAction(action))
					.map(async action => {

						if (action.expObject?.type !== this.txTypes.contentDelete.name) {
							return new Offer({
								/* Normal Offer action */
								...action.expObject,
								price: action.expObject?.price / 100,
								hash: action.transaction,
								prevhash: action.expObject?.hash,
								relay: !action?.completed
							})
						} else {
							/* Deleted Offer action */
							const txid = action.expObject?.txidEdit;
							
							if (!this.barteron.offers[txid]) {
								await this.getBrtOffersByHashes([txid]);
							}

							const offer = new Offer({
								...this.barteron.offers[txid],
								hash: action.transaction,
								prevhash: txid,
								published: "removed",
								relay: !action?.completed
							})

							return offer;
						}

			}) || []);
		});
	}

	/**
	 * Checking for offer action
	 * 
	 * @param {Object} action
	 * 
	 * @returns {Boolean}
	 */
	isOfferAction(action) {
		const
			expObject = action.expObject || {},
			keys = Object.keys(expObject),
			createOrEditOfferKeys = 'address,hash,language,caption,description,tag,condition,geohash'.split(','),
			deleteOfferKeys = 'txidEdit,type'.split(',');
		
		const
			isCreateOrEditOfferAction = (createOrEditOfferKeys.filter(item => !(keys.includes(item))).length == 0),
			isDeleteOfferAction = (
				deleteOfferKeys.filter(item => !(keys.includes(item))).length == 0 
				&& expObject.type === this.txTypes.contentDelete.name
			);

		return (isCreateOrEditOfferAction || isDeleteOfferAction);
	}

	/**
	 * Get vote actions
	 * 
	 * @returns {Promise}
	 */
	getVoteActions() {
		return this.sdk.get.actions().then(actions => {
			return (actions || []).filter(item => this.isVoteAction(item));
		});
	}

	/**
	 * Checking for vote action
	 * 
	 * @param {Object} action
	 * 
	 * @returns {Boolean}
	 */
	isVoteAction(action) {
		const type = action.expObject?.type;
		return (type === "comment" || type === "upvoteShare");
	}

	/**
	 * Upload images to imgur
	 * 
	 * @param {Array} data
	 * @param {Array[String]} data.images
	 * 
	 * @returns {Promise}
	 */
	uploadImagesToImgur(data) {
		return this.sdk.images.upload(data).then(result => {
			this.lastresult = "uploadImageToImgur: success (console.log)"
			return result.map(m => m.url);
		}).catch(e => this.setLastResult(e))
	}

	/**
	 * Check if permission is granted
	 * 
	 * @param {String} permission - Permission name
	 * 
	 * @returns {Promise}
	 */
	checkPermission(permission) {
		return this.sdk?.permissions.check({ permission });
	}

	/**
	 * Request permissions
	 * 
	 * @param {Array} permissions
	 * @param {Array} allowUnsigned
	 * 
	 * @returns {Promise}
	 */
	requestPermissions(permissions, allowUnsigned = ["geolocation"]) {
		return this.isLoggedIn().then(state => {
			if (!state && !permissions.filter(p => allowUnsigned.includes(p)).pop()) {
				return this.openRegistration();
			} else {
				return this.sdk.permissions.request(permissions);
			}
		});
	}

	/**
	 * Get bastyon address
	 * 
	 * @returns {Promise}
	 */
	async getAddress() {
		const isGranted = await this.checkPermission("account");

		if (isGranted) {
			return this.sdk.get.account().then(({ address }) => {
				this.lastresult = "user address: " + address;
				Vue.set(this, "_address", address);
				return address;
			}).catch(e => this.setLastResult(e));
		} else {
			return Promise.resolve(null);
		}
	}

	/**
	 * Get bastyon user by address
	 * 
	 * @prop {String} address
	 * 
	 * @returns {Promise}
	 */
	async getUserProfile(address) {
		if (!address && !this._address) await this.getAddress();
		address = address || this._address;
		if (!this._accounts[address]) Vue.set(this._accounts, address, {});

		return this.rpc("getuserprofile", [address]).then(accounts => {
			return accounts?.map(account => {
				Vue.set(this._accounts, account.address, account);
				return account;
			});
		});
	}

	/**
	 * Get bastyon account balance
	 * 
	 * @returns {Promise}
	 */
	getBalance() {
		return this.sdk.get.balance().then(balance => {
			this.lastresult = balance;
			Vue.set(this, "_balance", balance)
			return balance;
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Make payment
	 * 
	 * @returns {Promise}
	 */
	makePayment() {
		var data = {
			"recievers" : [{
				address : "PR7srzZt4EfcNb3s27grgmiG8aB9vYNV82",
				amount : 0.01
			}], 
			"feemode" : "include", 
			"message" : ""
		}

		this.sdk.payment(data).then(data => {
			this.lastresult = JSON.stringify(data, null, "\t")
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Check is app launched in bastyon
	 * 
	 * @returns {Boolean}
	 */
	inBastyon() {
		return this.sdk.inbastyon();
	}

	/**
	 * Request user location from bastyon
	 * 
	 * @param {Boolean} errorForwarding
	 * @param {Boolean} needRequestPermission
	 * 
	 * @returns {Promise}
	 */
	requestUserLocation(
		errorForwarding, 
		needRequestPermission
	) {
		return this.checkPermission("geolocation")
			.then(result => {
				return result || needRequestPermission && this.requestPermissions(["geolocation"]);
			}).catch(e => {
				this.setLastResult(e);
				if (errorForwarding) {
					throw new AppErrors.AppGeolocationPermissionError(e);
				} else {
					console.error(e);
					return false;
				}
			}).then(result => {
				if (result) {
					return this.sdk.get.geolocation().then(location => {
						this.lastresult = location;
						const latlng = Object.values(location);
						Vue.set(this, "_location", latlng);
						return latlng;
					})
				} else {
					return null;
				}
			}).catch(e => {
				this.setLastResult(e);
				if (errorForwarding) {
					throw new AppErrors.GeolocationRequestError(e);
				} else {
					console.error(e);
				}
			});
	}

	/**
	 * Currency from min-api
	 */
	getCurrency() {
		this._currency.pending = true;

		return fetch(`
			https://min-api.cryptocompare.com/data/price?
			${ new URLSearchParams({
				fsym: "PKOIN",
				tsyms: currencies.map(currency => currency)
			}).toString() }
		`)
			.then(result => result.json())
			.then(currency => {
				this.lastresult = currency;
				Vue.set(this, "_currency", currency);
				return currency;
			})
			.catch(e => this.setLastResult(e));
	}

	/**
	 * Get address of coodrinates
	 * 
	 * @param {Array} latLng
	 * @param {Object} [data]
	 * 
	 * @returns {Promise}
	 */
	geoLocation(latLng, data) {
		/* Send request to provider url */
		const provider = new OpenStreetMapProvider();

		return fetch(`
			${ provider.reverseUrl }?
			${ new URLSearchParams({
				format: "json",
				lat: latLng?.[0],
				lon: latLng?.[1],
				zoom: 18,
				addressdetails: 1,
				...data
			}).toString() }
		`)
			.then(result => result.json())
			.catch(e => this.setLastResult(e));
	}

	/**
	 * Get default location by time zone
	 * 
	 * @returns {Promise}
	 */
	getDefaultLocation() {
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		const
			cityMapping = CityTimezones.cityMapping,
			city = cityMapping.filter(f => f.timezone === timeZone).sort((a, b) => a.pop - b.pop).pop();
		
		const
			country = CountriesTimezones.getCountryForTimezone(timeZone),
			countryName = country?.name;
	
		if (city?.lat || city?.lng) {
			const result = [Number(city.lat || 0), Number(city.lng || 0)];
			return Promise.resolve(result);

		} else if (countryName) {
			const provider = new OpenStreetMapProvider();

			return fetch(`
				${ provider.searchUrl }?
				${ new URLSearchParams({
					format: "json",
					q: countryName,
				}).toString() }
			`)
				.then(result => result.json())
				.then(data => { 
					if (data?.length > 0 && (data[0].lat || data[0].lon)) {
						const item = data[0];
						return [Number(item.lat), Number(item.lon)];
					} else {
						throw new Error(`No data of lat, lon for country ${countryName}`);
					}
				})
				.catch(e => this.setLastResult(e));
		} else {
			return Promise.reject(new Error(`Can't define city or country by time zone ${timeZone}`));
		}
	}

	/**
	 * Check access to localstroage
	 * 
	 * @returns {Array}
	 */
	checkLocalStorageAccess() {
		function allStorage() {
			var values = [],
				keys = Object.keys(localStorage),
				i = keys.length;

			while ( i-- ) {
				values.push( localStorage.getItem(keys[i]) );
			}

			return values;
		}

		localStorage["checkLocalStorageAccess"] = true
		return this.localstorage = allStorage()
	}

	/**
	 * Get their tags value from offer
	 * 
	 * @param {Object} offer
	 * 
	 * @returns {Array}
	 */
	async getTheirTags(offer) {
		let result = [];

		const
			tags = offer?.tags,
			isMyList = tags?.includes("my_list"),
			isForNothing = tags?.includes("for_nothing");

		if(isMyList) {
			const account = await this.getBrtAccount(offer?.address);
			result = account?.tags;
		} else if(!isForNothing) {
			result = tags;
		}

		return result;
	}

	/**
	 * RPC requests
	 * 
	 * @prop {String} method
	 * @prop {Object} props
	 * 
	 * @returns {Promise}
	 */
	rpc(method, props) {
		return this.sdk.rpc(method, [props], {
			rpc : {
				fnode : '65.21.252.135:38081'
			}
		}).then(result => {
			return this.lastresult = result;
		}).catch(e => this.setLastResult(e));
	}

	/**
	 * Get Node data
	 * 
	 * @returns {Promise}
	 */
	getNodeInfo() {
		return this.rpc("getnodeinfo");
	}

	/**
	 * BARTERON REQUESTS
	 */

	/**
	 * Get barteron account
	 * 
	 * @param {String} address
	 * 
	 * @returns {Promise}
	 */
	getBrtAccount(address) {
		address = address || this._address;

		if (!address) return;

		if (!this.barteron._accounts[address]) {
			new Account({ address });
		}

		return this.rpc("getbarteronaccounts", [address]).then(accounts => {
			return accounts?.map(account => new Account(account));
		});
	}

	/**
	 * Get barteron offers by address
	 * 
	 * @param {String} address
	 * 
	 * @returns {Promise}
	 */
	async getBrtOffers(address) {
		if (!address && !this._address) await this.getAddress();
		address = address || this._address;

		return this.rpc("getbarteronoffersbyaddress", address).then(offers => {
			return offers?.map(offer => new Offer(offer)) || [];
		});
	}

	/**
	 * Get barteron offers by hashes
	 * 
	 * @param {Array[String]} hashes
	 * 
	 * @returns {Promise}
	 */
	getBrtOffersByHashes(hashes = []) {
		hashes.forEach(hash => {
			if (!this.barteron._offers[hash]) {
				new Offer({ hash });
			}
		});

		return this.rpc("getbarteronoffersbyroottxhashes", hashes).then(offers => {
			/* Sort to get offers in same order as requested */
			return (offers || [])
				.filter(offer => offer?.type !== this.txTypes.contentDelete.code)
				.sort((a, b) => hashes.indexOf(a.s2) - hashes.indexOf(b.s2))
				.map(offer => new Offer(offer));
		});
	}

	/**
	 * Get barteron offers details
	 * 
	 * @param {Object} request
	 * 
	 * Base
	 * 
	 * @param {Array[String]} request.offerIds Offer tx hashes
	 * @param {Boolean} request.includeAccounts Owner's accounts data, default: true
	 * @param {Boolean} request.includeScores Owner's accounts scores, default: true
	 * @param {Boolean} request.includeComments Owner's feedbacks, default: true
	 * @param {Boolean} request.includeCommentScores Owner's feedbacks scores, default: true
	 * 
	 * @returns {Promise}
	 */
	getBrtOffersDetails(request) {
		request?.offerIds.forEach(hash => {
			if (!this.barteron._details[hash]) {
				Vue.set(this.barteron._details, hash, {});
			}
		});

		return this.rpc("getbarteronoffersdetails", {
			offerIds: [],
			includeAccounts: true,
			includeScores: true,
			includeComments: true,
			includeCommentScores: true,
			...request
		}).then(details => {
			request?.offerIds.forEach(hash => {
				if (!this.empty(details)) {
					const data = {};

					/* Map responses with their hashes */
					for (const key in details) {
						if (key === "accounts") {
							data[key] = details[key]?.map(account => new Account(account)) || [];
						} else if (key === "offerScores") {
							data[key] = details[key]?.filter(f => f.s2 === hash).map(item => new OfferScore(item)) || [];
						} else if (key === "comments") {
							data[key] = details[key]?.filter(f => f.s3 === hash).map(item => new Comment(item)) || [];
						} else {
							data[key] = details[key]?.filter(f => f.s2 === hash) || [];
						}
					}

					Vue.set(this.barteron._details, hash, data);
				}
			});

			return details;
		}).catch(e => {
			console.error(e);
		});
	}

	/**
	 * Get barteron offers feed
	 * 
	 * @param {Object} request
	 * 
	 * Base
	 * 
	 * @param {String} request.lang en-US, ru-RU, etc
	 * @param {Array} request.tags Tags for filter offers
	 * @param {String} request.location location like "ABC%"
	 * @param {Number} request.priceMin 0 for unuse
	 * @param {Number} request.priceMax 0 for unuse
	 * @param {String} request.search String for fulltext search in Caption and Description
	 * 
	 * Pagination
	 * 
	 * @param {Number} request.topHeight Top height for start pagination
	 * @param {Number} request.pageStart Number of first page
	 * @param {Number} request.pageSize Count of offers in page
	 * @param {String} request.orderBy height | location | price
	 * @param {Boolean} request.orderDesc true | false
	 * 
	 * @returns {Promise}
	 */
	getBrtOffersFeed(request = {}) {
		const
			checkingData = request.checkingData,
			requestName = "getBrtOffersFeed";

		delete request.checkingData;

		return this.rpc("getbarteronfeed", request).then(feed => {

			if (checkingData?.checkRequestId) {
				const 
					ids = this.requestServiceData.ids,
					requestId = checkingData?.requestId,
					needReject = (requestId !== ids[requestName]);
				
				if (needReject) {
					throw new AppErrors.RequestIdError(
						requestName, 
						requestId, 
						ids.getBrtOffersFeed
					);
				}
			}

			return feed?.map(offer => new Offer(offer)) || [];
		});
	}

	/**
	 * Get barteron potencial offer deals
	 * 
	 * @param {Object} request
	 * 
	 * Base
	 * 
	 * @param {Array} request.addresses Filter potencial offers with these account addresses
	 * @param {Array} request.excludeAddresses Filter potencial offers by excluding offers with these addresses
	 * @param {String} request.location An SQLite3 language expression to be used with `LIKE` operator when comparing locations
	 * @param {Number} request.price Max amount of difference offer prices: abs(price1 - price2) < X
	 * @param {Array} request.myTags Filter potencial offers by the tags they are exchangable for
	 * @param {Array} request.theirTags
	 * 
	 * Pagination
	 * 
	 * @param {Number} request.topHeight Top height for start pagination
	 * @param {Number} request.pageStart Number of first page
	 * @param {Number} request.pageSize Count of offers in page
	 * @param {String} request.orderBy height | location | price
	 * @param {Boolean} request.orderDesc true | false
	 * 
	 * @returns {Promise}
	 */
	getBrtOfferDeals(request) {
		return this.rpc("getbarterondeals", {
			...request,
			myTags: (request?.myTags || []).map(tag => +tag),
			theirTags: (request?.theirTags || []).map(tag => +tag)
		}).then(deals => {
			return deals?.map(offer => new Offer(offer)) || [];
		});
	}

	/**
	 * Get potencial complex deals (3-side search)
	 * 
	 * @param {Object} request
	 * 
	 * Base
	 * 
	 * @param {Array} request.myTags Filter potencial offers by the tags they are exchangable for
	 * @param {Array} request.theirTags
	 * @param {String} request.location An SQLite3 language expression to be used with `LIKE` operator when comparing locations
	 * @param {Array} request.excludeAddresses Filter potencial offers by excluding offers with these addresses
	 * 
	 * @returns {Promise}
	 */
	getBrtOfferComplexDeals(request) {
		return this.rpc("getbarteroncomplexdeals", {
			...request,
			myTag: +request?.myTag,
			theirTags: (request?.theirTags || []).map(tag => +tag)
		}).then(data => {
			data?.map(match => {
				if (match.target) {
					match.target = new Offer(match.target);
					match.intermediates = match?.intermediates.map(offer => new Offer(offer)) || [];
				}
			});

			return data;
		});
	}

	/**
	 * Set to barteron account
	 * 
	 * @param {Object} data
	 * @param {String} data.address
	 * @param {Array} data.tags
	 * @param {String} data.geohash
	 * @param {Number} data.radius
	 * 
	 * @returns {Promise}
	 */
	setBrtAccount(data) {
		return this.sdk.barteron.account(data).then(result => result);
	}

	/**
	 * Set barteron offer
	 * 
	 * @param {Object} data
	 * 
	 * Base
	 * 
	 * @param {String} [data.hash]
	 * @param {String} data.language
	 * @param {String} data.caption
	 * @param {String} data.description
	 * @param {String} data.tag
	 * @param {Array} data.tags
	 * @param {String} data.condition
	 * @param {Array} data.images
	 * @param {String} data.geohash
	 * @param {Number} data.price
	 * 
	 * @returns {Promise}
	 */
	setBrtOffer(data) {
		return this.sdk.barteron.offer({
			...data,
			...{ hash: data.hash?.length === 64 ? data.hash : null }
		});
	}

	/**
	 * Remove an Offer
	 * 
	 * @param {String} param0
	 */
	delBrtOffer({ hash }) {
		return this.sdk.barteron.removeOffer({ hash });
	}

	/**
	 * Set barteron offer vote
	 * 
	 * @param {Object} data
	 * 
	 * Base
	 * 
	 * @param {String} data.offerId
	 * @param {String} data.value
	 * @param {String} data.address
	 */
	setBrtOfferVote(data) {
		return this.sdk.barteron.vote({
			share: data.offerId,
			vsaddress: data.address,
			value: data.value
		});
	}

	/**
	 * Set barteron offer comment
	 * 
	 * @param {Object} data
	 * 
	 * Base
	 * 
	 * @param {String} data.postid
	 * @param {Object} data.msg
	 * @param {String} data.msg.message
	 * @param {String} data.msg.info
	 * @param {String} [data.parentid]
	 * @param {String} [data.answerid]
	 * 
	 * @returns {Promise}
	 */
	setBrtComment(data) {
		return this.sdk.barteron.comment(data);
	}
}

export default SDK;