class VarInterface {
	private _name: string;
	protected value: any = null;

	constructor(name: string, startvalue: any = null) {
		this._name = name;
		this.value = startvalue;
	}

	get name(): string {
		return this._name;
	}

	get type(): 'undefined'|'object'|'boolean'|'number'|'string'|'array' {
		return this.getType();
	}

	get description(): string {
		return 'User defined variable';
	}

	getType(): 'undefined'|'object'|'boolean'|'number'|'string'|'array' {
		let type: 'undefined'|'object'|'boolean'|'number'|'string'|'array' = 'undefined';
		if(this.value !== null) {
			let to = typeof(this.value);
			if(to === 'object' && Array.isArray(this.value)) {
				type = 'array';
			} else if(['undefined','object','boolean','number','string'].indexOf(to) >= 0) {
				type = to as 'undefined'|'object'|'boolean'|'number'|'string';
			}
		}
		return type;
	}

	setTo(value: any, index?: number|string): Promise<void> {
		const self = this
		return new Promise((resolve) => {
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

	getValue(index?: string|number): Promise<any> {
		const self = this
		return new Promise((resolve) => {
			if(typeof(index) == 'number' && self.getType() == 'array') {
				if(index >= self.value.length) index = Math.random()
				if(index % 1 !== 0) {
					if(index >= 1) index = index - Math.floor(index)
					index = Math.floor(index * self.value.length)
				}
				if(index < 0) index = 0
				resolve(self.value[index])
				return
			}
			if(typeof(index) == 'string' && self.getType() == 'object') {
				if(!self.value.hasOwnProperty(index)) {
					resolve(null)
				} else {
					resolve(self.value[index])
				}
				return
			}

			resolve(self.value)
		})
	}

	delete(index?: string|number): Promise<void> {
		const self = this
		return new Promise((resolve, reject) => {
			if(typeof(index) == 'number' && self.getType() == 'array') {
				self.value.splice(index, 1)
				resolve()
				return
			}
			if(typeof(index) == 'string' && self.getType() == 'object') {
				delete self.value[index]
				resolve()
				return
			}

			switch(self.getType()) {
				case 'array':
					self.value = []
					break
				case 'object':
					self.value = {}
					break
				default:
					self.value = null
					break
			}

			resolve()
		})
	}

	toString(): string {
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
export = VarInterface