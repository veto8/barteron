import PopularList from "@/components/categories/popular-list/index.vue";
import BarterList from "@/components/barter/list/index.vue";
import Banner from "@/components/banner/index.vue";

export default {
	name: "Home",

	components: {
		PopularList,
		BarterList,
		Banner
	},

	data() {
		return {
			fetching: true,
			newFromGoods: [],
			mayMatchExchanges: []
		}
	},

	methods: {
		/**
		 * Get offers feed
		 */
		async getOffersFeed() {
			this.fetching = true;

			this.newFromGoods = await this.sdk.getBrtOffersFeed({
				location: (this.account?.geohash || "").slice(0, 5) + "%",
				pageSize: 100
			}).then(offers => {
				this.fetching = false;
				return offers.filter(offer => offer.active);
			});
		},

		async getComplexDeals() {
			if (this.address?.length) {
				/* Get my offers list */
				const myOffers = await this.sdk.getBrtOffers(this.address)
					.then(offers => offers.filter(offer => offer.active));
	
				/* Get potential exchange offers */
				if (myOffers?.length) {
					this.mayMatchExchanges = await Promise.all(
						myOffers.map(offer => {
							return this.sdk.getBrtOfferComplexDeals({
								myTag: offer.tag,
								theirTags: (() => {
									if (offer.tags?.includes("my_list")) {
										return this.account?.tags;
									} else {
										return offer.tags;
									}
								})(),
								excludeAddresses: [this.address]
							}).then(offers => {
								if (offers?.[0]?.target) {
									return offers[0].target.update({ source: offer })
								} else {
									return null;
								}
							});
						})
					).then(results => {
						return results.filter(result => result);
					});
				}
			}
		}
	},

	watch: {
		"account.geohash"() {
			console.log(123)
			this.getOffersFeed();
		}
	},

	mounted() {
		this.getOffersFeed();
		this.getComplexDeals();
	}
}