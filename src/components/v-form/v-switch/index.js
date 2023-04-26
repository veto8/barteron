export default {
	name: "Vswitch",

	props: {
		id: { type: [String, Array], default: () => [] },
		name: { type: [String, Array], default: () => [] },
		type: { type: [String, Array], default: () => [] },
		value: { type: [String, Array], default: () => [] },
		checked: { type: [String, Array], default: () => [] },
		label: { type: [String, Array], default: () => [] },
		
		vSize: String,
		vType: String
	},

	data() {
		return {
			switches: this.getSwitches([this.id, this.name, this.type, this.value, this.checked, this.label]),
			active: this.checked
		}
	},

	methods: {
		/**
		 * Convert String to Array
		 * 
		 * @param {String} param
		 */
		toArray(param) {
			return Array.isArray(param) ? param : [param];
		},

		/**
		 * Build switch list from props
		 * 
		 * @param {Array} switches 
		 * @return {Object[]}
		 */
		getSwitches(switches) {
			const sw = Object.keys(this.$props).reduce((o, p) => {
				o[p] = this.toArray(this[p]);

				return o;
			}, {});

			return switches
				.map(m => this.toArray(m))
				.sort((a, b) => a.length > b.length ? -1 : (a.length < b.length ? 1 : 0))[0]
				.reduce((a, v, i) => {
					a.push(
						/* Generate sw keys */
						Object.keys(sw).reduce((o, k) => {
							if (k === "type") o[k] = sw[k][i] ?? sw[k][sw[k].length - 1];
							else o[k] = sw[k][i] ?? null
	
							return o;
						}, {})
					);

					return a;
				}, []);
		}
	}
}