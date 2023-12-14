import BarterList from "@/components/barter/list/index.vue";
import Votes from "@/components/votes/index.vue";

export default {
	name: "Content",

	components: {
		BarterList,
		Votes
	},

	data() {
		return {
			offersList: [],
			bartersView: "tile"
		}
	},

	computed: {
		/**
		 * Get bastyon address
		 * 
		 * @returns {String}
		 */
		address() {
			const address = this.$route.params.id || this.sdk.address;

			this.getTabsContent(address);

			return address;
		},

		/**
		 * Show is this profile is your's
		 * 
		 * @returns {Boolean}
		 */
		isMyProfile() {
			return this.address === this.sdk.address;
		},

		/**
		 * Active tab param
		 * 
		 * @returns {String|undefined}
		 */
		activeTab() {
			return this.$route.hash;
		},

		/**
		 * Make list of view
		 * 
		 * @returns {Array}
		 */
		views() {
			return this.parseLabels("view");
		}
	},

	methods: {
		/**
		 * Load all tabs contents based by user address
		 * 
		 * @param {String} address 
		 */
		async getTabsContent(address) {
			/* Get offers list */
			this.offersList = await this.sdk.getBrtOffers(address);
		},

		/**
		 * Handle active tab change
		 * 
		 * @param {String} tab
		 */
		updatePath(tab) {
			this.$router.replace({ path: `/profile/${ this.address }`, hash: `#${ tab }` }).catch(() => {});
		},

		/**
		 * Parse labels object from localization
		 * 
		 * @param {String} label
		 * 
		 * @returns {Array}
		 */
		parseLabels(label) {
			return Object.keys(this.$t(label)).map((value, index) => {
				return { text: this.$t(`${ label }.${ value }`), value, default: index === 0 };
			});
		},

		/**
		 * View change callback
		 * 
		 * @param {Object} view 
		 */
		selectView(view) {
			this.bartersView = view?.value;
		}
	}
}