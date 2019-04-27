class VarInterface {

	constructor(name) {
		this.name = name
		this.value = null
	}

	getType() {
		let type = (this.value == null ? 'undefined' : typeof(this.value))
		if(type === 'object' && Array.isArray(this.value)) {
			type = 'array'
		}
		return type
	}

	setTo(value, index) {
		if(typeof(value) === 'string' && value.match(/^-?([0-9]+)$/)) {
			value = parseInt(value)
		} else if(typeof(value) === 'string' && value.match(/^-?([0-9]+)\.([0-9]+)$/)) {
			value = parseFloat(value)
		}

		if(typeof(index) === 'string') {
			if(this.getType() === 'undefined') {
				this.value = {}
			}
			if(this.getType() === 'object') {
				this.value[index] = value
			}
		} else if(typeof(index) === 'number') {
			index = Math.round(index)
			if(this.getType() === 'undefined') {
				this.value = []
			}
			if(this.getType() === 'array') {
				this.value[index] = value
			}
		} else {
			this.value = value
		}
	}

	addTo(value, index) {
		if(typeof(value) === 'string' && value.match(/^-?([0-9]+)$/)) {
			value = parseInt(value)
		} else if(typeof(value) === 'string' && value.match(/^-?([0-9]+)\.([0-9]+)$/)) {
			value = parseFloat(value)
		}

		if(typeof(index) === 'string') {
			if(this.getType() === 'undefined') {
				this.value = {}
			}
			if(this.getType() === 'object' && typeof(value) === 'number') {
				this.value[index] += value
				return
			}
		} else if(typeof(index) === 'number') {
			index = Math.round(index)
			if(this.getType() === 'undefined') {
				this.value = []
			}
			if(this.getType() === 'array' && typeof(value) === 'number') {
				this.value[index] += value
			}
		} else {
			if(typeof(value) === 'number' && this.getType() === 'number') {
				this.value += value
			} else if(this.getType() === 'array') {
				this.value.push(value)
			}
		}
	}

	getValue(index) {
		if((typeof(index) == 'number' && this.getType() == 'array') || (typeof(index) == 'string' && this.getType() == 'object')) {
			return this.value[index]
		}
		return this.value
	}

} 
module.exports = VarInterface