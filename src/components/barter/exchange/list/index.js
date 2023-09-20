export default {
	name: "ExchangeList",

	props: {
		tags: {
			type: Array,
			default: () => [
				"electronics",
				"belts",
				"shoes",
				"beauty_personal_care",
				"sports"
			]
		},
		visible: {
			type: Number,
			default: 5
		},
		title: {
			type: Boolean,
			default: true
		},
		vSize: {
			type: String,
			default: "md"
		}
	},

	data() {
		return {
			instance: this, /* Give instance to slot */
			id: Math.random().toString(16).slice(2),
			editable: false,
			vTags: [].concat(this.tags),
			show: this.visible,
			btnBackDisabled: true,
			btnAddDisabled: true,
			values: [],
			list: []
		}
	},

	methods: {
		/**
		 * Add children to list
		 * 
		 * @param {Array} ids
		 */
		add(ids) {
			this.list.push(
				ids.filter(
					id => this.categories.items[id] && this.$te(this.categories.items[id].name)
				).map(id => {
					const item = this.categories.items[id];
		
					return Object.assign(item, { value: this.$t(item.name) });
				})
			)
		},

		/**
		 * Back in children selection
		 */
		back() {
			const input = this.$refs.tag;

			if (this.values.length) {
				if (
					this.list.length > 1 &&
					this.values[this.values.length - 1]?.children
				) this.list.pop();
				this.values.pop();

				input.value = "";
				input.dataset.value = this.values[this.values.length - 1]?.name;
				input.placeholder = this.values[this.values.length - 1]?.value;
			}
			
			if (!this.values.length) this.reset();

			this.btnBackDisabled = this.btnAddDisabled = this.values.length < 1;
		},

		/**
		 * Reset children selection
		 */
		reset() {
			const input = this.$refs.tag;

			this.btnBackDisabled = true;
			this.btnAddDisabled = true;
			this.values = [];
			this.list.splice(1, this.list.length);
			input.placeholder = this.$t("exchange.add");
			input.value = input.dataset.value = "";
		},

		/**
		 * Toggle items to see
		 */
		toggle() {
			if (this.show < this.vTags.length) {
				this.show = this.vTags.length;
			} else {
				this.show = this.visible;
			}
		},

		/**
		 * Validate input value
		 * 
		 * @param {Boolean} check
		 * 
		 * @return {Boolean|Void}
		 */
		validate(check) {
			const
				input = this.$refs.tag,
				selected = this.list.reduce((r, v) => {
					return r.concat(v);
				}, []).find(s => s.value === (input.value || input.placeholder));

			if (check === true) {
				/* Check is value in list range */
				return !!selected;
			} else {
				/* Fill input value from option */
				this.btnAddDisabled = true;
				input.dataset.value = "";

				if (selected?.children.length) {
					input.placeholder = selected.value;
					input.value = "";
					this.add(selected.children);
				}
				
				if (selected) {
					this.values.push(selected);
					this.btnBackDisabled = false;
					this.btnAddDisabled = false;
					input.dataset.value = selected.name;
				}
			}
		},

		/**
		 * Insert tag to list
		 */
		insert() {
			const input = this.$refs.tag;
			
			if (this.validate(true) && !this.vTags.includes(input.dataset.value)) {
				this.vTags.push(input.dataset.value);
				this.reset();
			}
		},

		/**
		 * Remove tag
		 * 
		 * @param {Number} index
		 */
		remove(index) {
			this.vTags.splice(index, 1);
		},

		/**
		 * Edit state
		 */
		edit() {
			this.$nextTick(() => {
				setTimeout(() => this.$refs.tag.focus(), 1);
			});
			this.editable = true;
		},

		/**
		 * Cancel state
		 */
		cancel() {
			this.vTags = [].concat(this.tags);
			this.editable = false;
			this.reset();
		},

		/**
		 * Save state
		 */
		save() {
			this.insert();
			this.editable = false;
			this.$emit('change', this.vTags);
		}
	},

	watch: {
		/**
		 * Watch for lazy loading of tags
		 * 
		 * @param {Array} tags
		 */
		tags(tags) {
			this.vTags = [].concat(tags);
		}
	},

	created() {
		/* Get all categories and filter 1st level of them */
		this.add(
			Object.keys(this.categories.items || []).filter(
				id => !this.categories.items[id].parent
			)
		);
	}
}