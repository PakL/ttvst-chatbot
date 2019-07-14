class VarInterface {

	constructor(name) {
		this.name = name
		this.value = null
	}

	get type() {
		return this.getType()
	}

	getType() {
		let type = (this.value == null ? 'undefined' : typeof(this.value))
		if(type === 'object' && Array.isArray(this.value)) {
			type = 'array'
		}
		return type
	}

	setTo(value, index) {
		if(typeof(value) === 'string' && (this.type == 'undefined' || this.type == 'number') && value.match(/^-?([0-9]+)(\.([0-9]+))?$/)) {
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
				if(typeof(this.value[index]) === 'undefined') this.value[index] = 0
				this.value[index] += value
				return
			}
		} else if(typeof(index) === 'number') {
			index = Math.round(index)
			if(this.getType() === 'undefined') {
				this.value = []
			}
			if(this.getType() === 'array' && typeof(value) === 'number') {
				if(typeof(this.value[index]) === 'undefined') this.value[index] = 0
				this.value[index] += value
			}
		} else {
			if(typeof(value) === 'number' && this.getType() === 'number') {
				this.value += value
			} else if(this.getType() === 'array') {
				this.value.push(value)
			} else if(this.getType() === 'undefined') {
				this.value = value
			}
		}
	}

	getValue(index) {
		if(typeof(index) == 'number' && this.getType() == 'array') {
			if(index >= this.value.length) index = Math.random()
			if(index % 1 !== 0) {
				if(index >= 1) index = index - Math.floor(index)
				index = Math.floor(index * this.value.length)
			}
			if(index < 0) index = 0
			return this.value[index]
		}
		if(typeof(index) == 'string' && this.getType() == 'object') {
			if(!this.value.hasOwnProperty(index)) return null
			return this.value[index]
		}
		return this.value
	}

	toString() {
		if(this.type === 'object') {
			let v = []
			for(let index in this.value) {
				if(v.length == 5) {
					v.push('...')
					break
				}
				v.push(index + ': ' + this.value[index])
			}
			return v.join(', ')
		} else if(this.type === 'array') {
			let v = this.value.slice(0, 5)
			if(this.value.length > 5) v.push('...')
			return v.join(', ')
		} else if(this.type === 'number') {
			return this.value.toString()
		} else if(this.type === 'string') {
			return this.value
		} else {
			return this.type
		}
	}

} 
module.exports = VarInterface