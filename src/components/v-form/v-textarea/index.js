export default {
	name: "Vtextarea",

	props: {
		id: String,
		name: String,
		readonly: String,
		placeholder: String,
		value: String,
		resize: String,
		length: String,

		vSize: String,
	},

	data() {
		return {
			content: this.value ?? "",
			count: 0
		}
	},

	watch: {
		/**
		 * Watch on text length and adjust height
		 * 
		 * @param {String} val 
		 */
		content(val) {
			if (this.length && val.length > this.length) {
				this.content = val.substring(0, this.length);
			}

			this.count = val.length;
			
			this.$nextTick(() => {
				this.$refs.textarea.style.height = "1px";
				this.$refs.textarea.style.height = (this.$refs.textarea.scrollHeight) + "px";
			});
		},

		value(val) {
			this.content = val;
		}
	}
}