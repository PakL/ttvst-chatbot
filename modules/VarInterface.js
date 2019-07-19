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
		const self = this
		return new Promise((resolve, reject) => {
			if(typeof(value) === 'string' && (self.type == 'undefined' || self.type == 'number') && value.match(/^-?([0-9]+)(\.([0-9]+))?$/)) {
				value = parseFloat(value)
			}
	
			if(typeof(index) === 'string') {
				if(self.getType() === 'undefined') {
					self.value = {}
				}
				if(self.getType() === 'object') {
					self.value[index] = value
				}
			} else if(typeof(index) === 'number') {
				index = Math.round(index)
				if(self.getType() === 'undefined') {
					self.value = []
				}
				if(self.getType() === 'array') {
					self.value[index] = value
				}
			} else {
				self.value = value
			}

			resolve()
		})
	}

	addTo(value, index) {
		const self = this
		return new Promise((resolve, reject) => {
			if(typeof(value) === 'string' && value.match(/^-?([0-9]+)$/)) {
				value = parseInt(value)
			} else if(typeof(value) === 'string' && value.match(/^-?([0-9]+)\.([0-9]+)$/)) {
				value = parseFloat(value)
			}

			if(typeof(index) === 'string') {
				if(self.getType() === 'undefined') {
					self.value = {}
				}
				if(self.getType() === 'object' && typeof(value) === 'number') {
					if(typeof(self.value[index]) === 'undefined') self.value[index] = 0
					self.value[index] += value
					return
				}
			} else if(typeof(index) === 'number') {
				index = Math.round(index)
				if(self.getType() === 'undefined') {
					self.value = []
				}
				if(self.getType() === 'array' && typeof(value) === 'number') {
					if(typeof(self.value[index]) === 'undefined') self.value[index] = 0
					self.value[index] += value
				}
			} else {
				if(typeof(value) === 'number' && self.getType() === 'number') {
					self.value += value
				} else if(self.getType() === 'array') {
					self.value.push(value)
				} else if(self.getType() === 'undefined') {
					self.value = value
				}
			}

			resolve()
		})
	}

	getValue(index) {
		const self = this
		return new Promise((resolve, reject) => {
			if(typeof(index) == 'number' && self.getType() == 'array') {
				if(index >= self.value.length) index = Math.random()
				if(index % 1 !== 0) {
					if(index >= 1) index = index - Math.floor(index)
					index = Math.floor(index * self.value.length)
				}
				if(index < 0) index = 0
				return self.value[index]
			}
			if(typeof(index) == 'string' && self.getType() == 'object') {
				if(!self.value.hasOwnProperty(index)) return null
				return self.value[index]
			}

			resolve(self.value)
		})
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